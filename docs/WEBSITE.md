# Website and documentation delivery

The public documentation site is separate from the desktop renderer and its release versions. It renders the same canonical product guide as in-app Help and provides all 56 configured language guides. Presentation changes do not allocate an application package version or certify native model/platform execution.

See [documentation website setup](../website/README.md) for local reading, maintenance checks and the portable documentation build. The project owner is also preparing a new Studio landing and local infographic films for future independent hosting at `ziaforge.studio`; those local deliverables are excluded from documentation publication until their own hosting step.

## Source boundaries

- Product help: canonical `docs/help/en.json`, its registered translations and `scripts/help/generate.cjs`. Generated HTML and Markdown must agree with their actual source.
- Guide presentation: `website/assets/site.css`, `website/assets/guide.js`, inherited branding and bundled licensed fonts. Search and navigation operate on the current guide without external services.
- Offline guides: English `website/guide.html` and locale pages `website/guides/`. Each guide retains its language direction, source-policy notice and source-contract links.
- Static tools: `scripts/website/serve.cjs`, `check.cjs --docs-only` and `build.cjs --docs-only`. These use Node.js and public files; no desktop build or provider account is required.

Change the template and shared presentation for a visual redesign. Change canonical guide prose only for a product-content change, following [HELP_MAINTENANCE.md](HELP_MAINTENANCE.md). Preserve translation source hashes and genuine human-review status. Do not hand-edit generated manuals.

## Verification

Run `node scripts/help/generate.cjs --check` and `node scripts/website/check.cjs --docs-only`. Inspect actual desktop/mobile rendering, guide search and navigation, language selection, keyboard focus and RTL. Keep browser evidence outside distributable source and exclude credentials or private project content.

Desktop fixtures, native model inference, package checks and website checks are distinct results. A refreshed guide cannot be reported as new application certification.

## Publication scope

`.github/workflows/website.yml` runs only when dispatched and stages documentation with `--docs-only`. The root and `website/index.html` are generated guide entry points. Its website allowlist contains the 56 guide pages, guide presentation, language-compatible fonts and inherited icon; new landing HTML/scripts/dictionaries and video assets are excluded.

The portable documentation directory retains public source needed by guide links. Private research, profiles, authentication and dependencies are excluded. The existing GitHub Pages destination remains separate from the future custom domain. Do not add a CNAME, change DNS or upload films as part of documentation maintenance.
