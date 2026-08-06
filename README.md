# CRTify

A browser-based CRT monitor overlay generator. Upload images, GIFs, or videos, apply retro CRT effects and draggable text overlays, then export — all client-side with no server required.

## Features

- **CRT effects**: curvature, scanlines, chromatic aberration, vignette, noise, bloom, phosphor tint, brightness/contrast, flicker
- **Text overlays**: multiple draggable layers with retro fonts (VT323, Press Start 2P), glow, and opacity
- **Media support**: PNG/JPEG images, animated GIFs, MP4/WebM videos
- **Export**: PNG, JPEG, GIF (re-encoded), MP4/WebM (via ffmpeg.wasm or MediaRecorder fallback)
- **Live preview** with play/pause for GIFs and videos

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

Output is in `dist/`.

## Deployment

CRTify is a static SPA served from the `/CRTify/` base path (GitHub Pages project site).

Video export uses ffmpeg.wasm, which requires these HTTP headers for `SharedArrayBuffer`:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### GitHub Pages

The included workflow (`.github/workflows/deploy.yml`) builds and deploys on pushes to `main`. Enable Pages in repo settings with **Source: GitHub Actions**.

### Netlify

A [`public/_headers`](public/_headers) file is included for Netlify deployments. If hosting at the site root (not `/CRTify/`), change `base` in [`vite.config.ts`](vite.config.ts) to `'/'`.

## Limits

- Max resolution: 1920×1920
- GIFs: up to 300 frames
- Video export: up to ~30 seconds at 30fps (browser memory dependent)

## Tech Stack

- Vite + React + TypeScript
- WebGL CRT shader
- gifuct-js + gif.js for GIF processing
- @ffmpeg/ffmpeg for video export

## License

MIT
