# PWA icons

Drop the following PNG icons in this directory before deploying:

- `icon-192.png` — 192×192, used as the home-screen icon on Android.
- `icon-512.png` — 512×512, used as the splash icon on iOS / Android.
- `../apple-touch-icon.png` — 180×180, used by iOS Safari "Add to Home Screen".

You can generate all three from `/public/icon.svg` with a tool like
[`pwa-asset-generator`](https://github.com/onderceylan/pwa-asset-generator):

```bash
npx pwa-asset-generator public/icon.svg public/icons \
  --manifest public/manifest.webmanifest --type png --padding "12%"
```

Until real PNGs are added, installed PWAs will fall back to the SVG/favicon and
some platforms (notably iOS) will show a generic icon.
