import vertSource from '../shaders/crt.vert?raw';
import fragSource from '../shaders/crt.frag?raw';
import type { CrtSettings } from '../types/crt';

export interface AnimatedDistortion {
  amount: number;
  speed: number;
  phase: number;
}

export interface LayerDistortionOptions {
  wave?: AnimatedDistortion;
  ripple?: AnimatedDistortion;
  bulge?: AnimatedDistortion;
  shimmer?: AnimatedDistortion;
}

interface RenderOptions {
  preserveAlpha?: boolean;
  layerDistortion?: LayerDistortionOptions;
}

type SizedSource = TexImageSource & {
  videoWidth?: number;
  videoHeight?: number;
  displayWidth?: number;
  displayHeight?: number;
  width?: number;
  height?: number;
};

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
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info}`);
  }
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

function sourceSize(source: SizedSource): [number, number] {
  if (source.videoWidth && source.videoHeight) return [source.videoWidth, source.videoHeight];
  if (source.displayWidth && source.displayHeight) return [source.displayWidth, source.displayHeight];
  return [source.width ?? 0, source.height ?? 0];
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
  private uniforms = new Map<string, WebGLUniformLocation | null>();
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
    gl.useProgram(this.program);

    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create texture');
    this.texture = texture;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const positionBuffer = gl.createBuffer();
    const texCoordBuffer = gl.createBuffer();
    if (!positionBuffer || !texCoordBuffer) throw new Error('Failed to create buffers');
    this.positionBuffer = positionBuffer;
    this.texCoordBuffer = texCoordBuffer;

    const posLoc = gl.getAttribLocation(this.program, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texLoc = gl.getAttribLocation(this.program, 'a_texCoord');
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1i(this.uniform('u_image'), 0);

    this.compositeCanvas = document.createElement('canvas');
    const ctx = this.compositeCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create 2D context');
    this.compositeCtx = ctx;
  }

  private uniform(name: string): WebGLUniformLocation | null {
    let loc = this.uniforms.get(name);
    if (loc === undefined) {
      loc = this.gl.getUniformLocation(this.program, name);
      this.uniforms.set(name, loc);
    }
    return loc;
  }

  resize(width: number, height: number) {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    this.outputCanvas.width = width;
    this.outputCanvas.height = height;
    this.compositeCanvas.width = width;
    this.compositeCanvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  renderFrame(
    source: TexImageSource,
    settings: CrtSettings,
    time = 0,
    options: RenderOptions = {},
  ): HTMLCanvasElement {
    const { gl, texture } = this;
    const [srcWidth, srcHeight] = sourceSize(source as SizedSource);
    this.resize(srcWidth, srcHeight);
    const preserveAlpha = options.preserveAlpha ?? false;
    const distortion = options.layerDistortion ?? {};

    gl.clearColor(0, 0, 0, preserveAlpha ? 0 : 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    const [tr, tg, tb] = hexToRgb(settings.tint);
    const scalars: [string, number][] = [
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
      ['u_rgbMask', settings.rgbMask],
      ['u_interlace', settings.interlace],
      ['u_rollBar', settings.rollBar],
      ['u_phosphorDecay', settings.phosphorDecay],
    ];
    for (const [name, value] of scalars) gl.uniform1f(this.uniform(name), value);
    gl.uniform2f(this.uniform('u_resolution'), this.width, this.height);
    gl.uniform3f(this.uniform('u_tint'), tr, tg, tb);

    const setDistortion = (name: string, effect?: AnimatedDistortion) => {
      gl.uniform3f(this.uniform(name), effect?.amount ?? 0, effect?.speed ?? 0, effect?.phase ?? 0);
    };
    setDistortion('u_layerWave', distortion.wave);
    setDistortion('u_layerRipple', distortion.ripple);
    setDistortion('u_layerBulge', distortion.bulge);
    setDistortion('u_layerShimmer', distortion.shimmer);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.compositeCtx.clearRect(0, 0, this.width, this.height);
    this.compositeCtx.drawImage(this.outputCanvas, 0, 0);
    return this.compositeCanvas;
  }

  getCanvas(): HTMLCanvasElement {
    return this.compositeCanvas;
  }

  /** Free GPU resources and the context itself; browsers cap live WebGL contexts (~16). */
  destroy() {
    const { gl } = this;
    gl.deleteProgram(this.program);
    gl.deleteTexture(this.texture);
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.texCoordBuffer);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.outputCanvas.width = this.outputCanvas.height = 0;
    this.compositeCanvas.width = this.compositeCanvas.height = 0;
    this.width = this.height = 0;
  }
}
