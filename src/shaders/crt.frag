precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_curvature;
uniform float u_scanlineIntensity;
uniform float u_scanlineCount;
uniform float u_aberration;
uniform float u_vignette;
uniform float u_noise;
uniform float u_bloom;
uniform vec3 u_tint;
uniform float u_tintStrength;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_flicker;
uniform float u_flickerIntensity;

varying vec2 v_texCoord;

float random(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 curveUV(vec2 uv, float amount) {
  vec2 centered = uv - 0.5;
  float dist = dot(centered, centered);
  return uv + centered * dist * amount;
}

vec3 sampleImage(vec2 uv) {
  float aberr = u_aberration;
  vec2 dir = normalize(uv - 0.5 + 0.0001);
  float r = texture2D(u_image, uv + dir * aberr).r;
  float g = texture2D(u_image, uv).g;
  float b = texture2D(u_image, uv - dir * aberr).b;
  return vec3(r, g, b);
}

void main() {
  vec2 uv = curveUV(v_texCoord, u_curvature * 0.5);

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec3 color = sampleImage(uv);

  float scanline = sin(uv.y * u_scanlineCount * 3.14159) * 0.5 + 0.5;
  color *= 1.0 - u_scanlineIntensity * (1.0 - scanline);

  float bloomFactor = max(0.0, dot(color, vec3(0.299, 0.587, 0.114)) - 0.6);
  color += color * bloomFactor * u_bloom;

  color = mix(color, color * u_tint, u_tintStrength);

  color = (color - 0.5) * u_contrast + 0.5;
  color *= u_brightness;

  if (u_flicker > 0.5) {
    float flick = 1.0 + sin(u_time * 30.0) * u_flickerIntensity;
    color *= flick;
  }

  float grain = (random(uv * u_resolution + u_time) - 0.5) * u_noise;
  color += grain;

  vec2 vigUv = v_texCoord - 0.5;
  float vig = 1.0 - dot(vigUv, vigUv) * u_vignette * 2.5;
  color *= clamp(vig, 0.0, 1.0);

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
