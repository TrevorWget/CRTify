import vertSource from '../shaders/crt.vert?raw';
import fragSource from '../shaders/crt.frag?raw';
import type { CrtSettings } from '../types/crt';

interface RenderOptions {
  preserveAlpha?: boolean;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSource);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    throw new Error(`Program link error: ${info}`);
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0.2, 1.0, 0.4];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
}

export class CrtRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private positionBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;
  private outputCanvas: HTMLCanvasElement;
  private compositeCanvas: HTMLCanvasElement;
  private compositeCtx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;

  constructor() {
    this.outputCanvas = document.createElement('canvas');
    const gl = this.outputCanvas.getContext('webgl', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;
    this.program = createProgram(gl);

    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create texture');
    this.texture = texture;

    const positionBuffer = gl.createBuffer();
    const texCoordBuffer = gl.createBuffer();
    if (!positionBuffer || !texCoordBuffer) throw new Error('Failed to create buffers');
    this.positionBuffer = positionBuffer;
    this.texCoordBuffer = texCoordBuffer;

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), gl.STATIC_DRAW);

    this.compositeCanvas = document.createElement('canvas');
    const ctx = this.compositeCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create 2D context');
    this.compositeCtx = ctx;
  }

  resize(width: number, height: number) {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    this.outputCanvas.width = width;
    this.outputCanvas.height = height;
    this.compositeCanvas.width = width;
    this.compositeCanvas.height = height;
    const { gl } = this;
    gl.viewport(0, 0, width, height);
  }

  renderFrame(
    source: TexImageSource & { videoWidth?: number; videoHeight?: number },
    settings: CrtSettings,
    time = 0,
    options: RenderOptions = {},
  ): HTMLCanvasElement {
    const { gl, program, texture } = this;
    const srcWidth =
      'videoWidth' in source && source.videoWidth
        ? source.videoWidth
        : 'displayWidth' in source
          ? (source as VideoFrame).displayWidth
          : (source as HTMLImageElement | HTMLCanvasElement).width;
    const srcHeight =
      'videoHeight' in source && source.videoHeight
        ? source.videoHeight
        : 'displayHeight' in source
          ? (source as VideoFrame).displayHeight
          : (source as HTMLImageElement | HTMLCanvasElement).height;
    this.resize(srcWidth, srcHeight);
    const preserveAlpha = options.preserveAlpha ?? false;

    gl.clearColor(0, 0, 0, preserveAlpha ? 0 : 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    gl.useProgram(program);

    const posLoc = gl.getAttribLocation(program, 'a_position');
    const texLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    const [tr, tg, tb] = hexToRgb(settings.tint);
    const uniforms: [string, number | [number, number]][] = [
      ['u_resolution', [this.width, this.height]],
      ['u_time', time],
      ['u_curvature', settings.curvature],
      ['u_scanlineIntensity', settings.scanlineIntensity],
      ['u_scanlineCount', settings.scanlineCount],
      ['u_aberration', settings.aberration],
      ['u_vignette', settings.vignette],
      ['u_noise', settings.noise],
      ['u_bloom', settings.bloom],
      ['u_tintStrength', settings.tintStrength],
      ['u_brightness', settings.brightness],
      ['u_contrast', settings.contrast],
      ['u_flicker', settings.flicker ? 1.0 : 0.0],
      ['u_flickerIntensity', settings.flickerIntensity],
      ['u_preserveAlpha', preserveAlpha ? 1.0 : 0.0],
    ];

    gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
    for (const [name, value] of uniforms) {
      const loc = gl.getUniformLocation(program, name);
      if (Array.isArray(value)) {
        gl.uniform2f(loc, value[0], value[1]);
      } else {
        gl.uniform1f(loc, value);
      }
    }
    gl.uniform3f(gl.getUniformLocation(program, 'u_tint'), tr, tg, tb);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.compositeCtx.clearRect(0, 0, this.width, this.height);
    this.compositeCtx.drawImage(this.outputCanvas, 0, 0);
    return this.compositeCanvas;
  }

  getCanvas(): HTMLCanvasElement {
    return this.compositeCanvas;
  }

  destroy() {
    const { gl } = this;
    gl.deleteProgram(this.program);
    gl.deleteTexture(this.texture);
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.texCoordBuffer);
  }
}
