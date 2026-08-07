# CRTify

Browser-based CRT monitor overlay editor. Upload an image, GIF, animated WebP, or video; apply CRT looks and overlays; export — entirely client-side, no server required.

## Features

- **CRT look**: curvature, scanlines, chromatic aberration, vignette, noise, bloom, phosphor tint, brightness/contrast, flicker, RGB mask, interlace, roll bar, phosphor decay, optional TV bezel
- **Look presets**: VHS, Arcade, Amber, Broadcast, Security, plus custom presets saved in localStorage; shareable look URL hash (`#look=…`)
- **Overlays**: text (multiline, custom fonts), shapes, and stickers — with glow, blur, brightness, stroke, warp, skew, and CRT-aware distortion
- **Keyframes**: animate overlay opacity and position across a GIF/WebP/video timeline
- **Media**: PNG/JPEG/WebP, animated GIF/WebP, MP4/WebM; clipboard paste, webcam capture, batch stills
- **Projects**: save/load `.crtify.json` (reattach media after load)
- **Export**: PNG, JPEG, WebP (still or animated), GIF, MP4, WebM — including cross-format export and optional keep-audio remux for video
- **Live preview** with play/pause for animations and video
- **PWA shell** for offline install of the app shell

## Getting started

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build    # output in dist/
npm run preview  # local production preview
npm run lint
```

## Usage (quick)

1. **Insert media** — drop a file, use the uploader, paste from the clipboard, or capture from the webcam.
2. **Tune the CRT** — use Effect controls or pick a Look Preset.
3. **Add overlays** — text, shapes, or stickers; drag on the preview to place them.
4. **Keyframes** (animated media) — select a layer, set position/opacity, then store `@ 0%` / `@ 50%` / `@ 100%` of the timeline. Values interpolate between points during preview and export.
5. **Export** — choose format and encoding options from the Export menu (defaults follow the uploaded type when possible).

Undo/Redo is available for editor state. Projects can be saved as `.crtify.json` and reopened later (you’ll need to reattach the original media file).

## Deployment

CRTify is a static SPA. The included GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys on pushes to `main` when Pages is set to **Source: GitHub Actions**.

### Base path

Vite’s `base` in [`vite.config.ts`](vite.config.ts) must match how the site is hosted:

| Hosting | Typical `base` | Also update |
| --- | --- | --- |
| Custom domain / site root (e.g. `https://example.com/`) | `'/'` | `public/manifest.webmanifest` (`start_url`, `scope`, icon `src`) |
| GitHub Pages project site (`https://<user>.github.io/<repo>/`) | `'/<repo>/'` | Same manifest fields to match that path |

If you use a custom domain on GitHub Pages, add a [`public/CNAME`](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) file containing only the hostname (Vite copies `public/` into `dist`), then:

1. Point DNS (CNAME subdomain → `<user>.github.io`, or apex A/ALIAS records per GitHub’s docs).
2. Repo → **Settings** → **Pages** → **Custom domain** → save your domain.
3. Enable **Enforce HTTPS** after DNS verifies.

### SharedArrayBuffer / video export

ffmpeg.wasm works best with these headers (set for local Vite `server` / `preview` in `vite.config.ts`):

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

GitHub Pages does not apply [`public/_headers`](public/_headers) (that file is for Netlify). Export still often works via blob URLs; if video encode fails in a given host, check whether those headers are available.

### Netlify

Deploy `dist/` (or connect the repo and use the default Vite build). [`public/_headers`](public/_headers) supplies COOP/COEP when using Netlify.

## Limits

Soft ceilings for browser memory (not hard format limits):

- Max resolution: 4096×4096
- GIF / animated WebP: up to 1200 frames, with a resolution-aware ~1 GB decode guard
- Video export: up to ~3 minutes at 30fps (~5400 processed frames)

Higher settings can exhaust tab memory and crash the page.

## Tech stack

- Vite + React + TypeScript
- WebGL CRT shader
- gifuct-js + gif.js for GIF decode/encode
- wasm-webp for animated WebP fallback decode
- @ffmpeg/ffmpeg for video export / audio remux

## License

MIT
