# Offline project website

Open `index.html` directly in a browser. The page, stylesheet, existing project logo and `guide.html` are local; no CDN, remote fonts, analytics, provider calls or generated download URLs are used.

The hero is an original schematic of the workflow, explicitly not a runtime screenshot. The macOS section describes a preview and links to source release documentation; a public installer is not fabricated. `guide.html` is the readable Russian counterpart of `docs/USER_GUIDE.md`; the application includes Russian and English guidance in `src/components/helpContent.ts`.

Source-document links require keeping this `website/` beside `docs/` and `LICENSE`. For an eventual hosted release, publish those resources or update the links to verified destinations before deployment. This folder has not been deployed by creating it.

The logo is copied byte-for-byte from `public/app-logo.jpeg`, retaining its existing provenance and limitations. No new rights or asset certification is implied.
