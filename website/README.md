# ZIAForge documentation website

The public GitHub Pages site serves the generated product guide in all 56 application languages. English is canonical; the other guides carry their current machine-translation notice and source hash. The site keeps the product's inherited icon and loading-screen identity.

The new Studio landing and original video tutorials are being prepared locally for the owner's future independent hosting. They are separate from this documentation publication. In that local workspace, see `LOCAL_STUDIO_README.md` for the complete landing, films and portable host build.

## Read locally

From the repository root, with Node.js 24:

```sh
node scripts/website/serve.cjs --port 4173
```

Open `http://127.0.0.1:4173/website/guide.html`, or `website/guides/ru.html` for Russian. The preview binds to loopback. The static guide can also be opened directly in a browser without starting the application or contacting a model.

No CDN, remote font, analytics, model inference or account login is required for the guide. Related source-contract links use the public repository's source structure. Keep its files together for offline reading.

## Maintain the guide

Edit only the canonical `docs/help/en.json` for product-content changes and follow `docs/HELP_MAINTENANCE.md`. Visual changes belong in `scripts/help/generate.cjs`, `assets/site.css` and `assets/guide.js`. Do not hand-edit generated manuals or retag an old translation against a new source hash.

```sh
node scripts/help/generate.cjs
node scripts/help/generate.cjs --check
node scripts/website/check.cjs --docs-only
```

Automated structural checks do not certify native-speaker language quality. Interface translations and help translations have separate provenance.

## Stage and publish documentation

```sh
node scripts/website/build.cjs --docs-only
```

A fresh portable output is written to `out/documentation/`. The builder refuses a nonempty output and writes a file/hash manifest. The root page is the English guide, with a language selector for every served guide. Public source required by contract links is retained; dependencies, private research, runtime profiles and credentials are excluded.

The manually dispatched `Documentation website` workflow validates the guide and publishes this documentation-only output to GitHub Pages. Its allowlist excludes the local Studio landing, new films, caption sources and landing dictionaries. It does not configure `ziaforge.studio`, change DNS, create a `CNAME` or upload to video platforms.

See [website delivery](../docs/WEBSITE.md) for source boundaries and publication scope.
