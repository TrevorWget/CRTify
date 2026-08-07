# CRTify

A browser-based CRT monitor overlay generator. Upload images, GIFs, or videos, apply retro CRT effects and draggable text overlays, then export — all client-side with no server required.

## Features

- **CRT effects**: curvature, scanlines, chromatic aberration, vignette, noise, bloom, phosphor tint, brightness/contrast, flicker
- **Text overlays**: multiple draggable layers with retro fonts (VT323, Press Start 2P), glow, and opacity
- **Media support**: PNG/JPEG/WebP images, animated GIFs, MP4/WebM videos
- **Export**: PNG, JPEG, WebP, GIF (re-encoded), MP4/WebM (via ffmpeg.wasm or MediaRecorder fallback)
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

CRTify is a static SPA. Production is configured for the custom domain
[`https://crtify.trevorwilliams.dev`](https://crtify.trevorwilliams.dev)
(`base: '/'` in [`vite.config.ts`](vite.config.ts), plus [`public/CNAME`](public/CNAME)).

Video export uses ffmpeg.wasm, which requires these HTTP headers for `SharedArrayBuffer`:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### GitHub Pages (custom domain)

1. DNS: create a **CNAME** for `crtify.trevorwilliams.dev` → `trevorwget.github.io`.
2. Repo → **Settings** → **Pages** → **Custom domain** → `crtify.trevorwilliams.dev` → Save.
3. After DNS verifies, enable **Enforce HTTPS**.
4. The included workflow (`.github/workflows/deploy.yml`) builds and deploys on pushes to `main` (Source: **GitHub Actions**).

To serve from the project path `https://<user>.github.io/CRTify/` instead, set `base: '/CRTify/'` and update the PWA `start_url` / `scope` / icon paths in `public/manifest.webmanifest`.

### Netlify

A [`public/_headers`](public/_headers) file is included for Netlify deployments.

## Limits

These are soft ceilings chosen for browser memory, not hard format limits:

- Max resolution: 4096×4096
- GIFs: up to 1200 frames, subject to a resolution-aware 1 GB decode guard
- Video export: up to ~3 minutes at 30fps (~5400 processed frames)

Going higher is possible in theory, but decoded GIFs and ffmpeg.wasm frame buffers can exhaust tab memory and crash the page.

## Tech Stack

- Vite + React + TypeScript
- WebGL CRT shader
- gifuct-js + gif.js for GIF processing
- @ffmpeg/ffmpeg for video export

## License

MIT
