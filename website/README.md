# html2figma website

Production: https://html2figma-one.vercel.app

Astro static site with React islands, Tailwind CSS 4 and shadcn/ui for the html2figma library: bilingual branding, guides/API documentation, HTML/CSS Playground, six-case Gallery, and a downloadable standalone Figma development plugin.

## Local development

Use Node **24.x** (`.nvmrc` selects 24.21.0, matching local tooling and Vercel's configured major version). CI reads this same file.

```sh
cd website
nvm use
npm ci
npm run dev
```

Open `http://127.0.0.1:4321`. English routes start at `/`, Chinese at `/zh-cn/`. Language switches preserve the page.

```sh
npm run build:preview
npm run preview
# Built Preview: http://127.0.0.1:4322

npm run verify
```

Verification prepares assets, checks Astro/client/plugin types, compiles the actual TypeScript snippets extracted from both sets of Markdown documentation, builds in Preview mode and runs Playwright against its own built-site server on port 4322. Tests never reuse the development server; stop a manual `npm run preview` session before running verification. On a new machine, run `npx playwright install chromium` before the browser tests. The library's independent acceptance remains `npm run verify:all` from the repository root.

## Organization

- `src/content/docs/{en,zh-cn}/`: translated Markdown with matching slugs/order.
- `src/components/`, `src/layouts/`, `src/styles/`: brand pages and document layout.
- `src/client/`: editor, Gallery, isolated preview runner and navigation.
- `src/lib/preview.ts`: opaque sandbox iframe protocol and JSON validation.
- `plugin/`: standalone plugin runtime and bundled UI, using the pinned public library.
- `src/components/ui/`: official shadcn/ui primitives, installed with CLI 4.21.4 and customized through site components/theme tokens.
- `src/components/site/`: React islands for navigation, Playground and Gallery; shared branded controls and document widgets.
- `src/data/examples/`: six examples composed from shadcn Card/Button/Badge, matching CSS skins and owned image artwork.
- `scripts/prepare-assets.mjs`: renders the example components to standalone editable HTML/CSS, embeds PNGs, copies the root brand, and bundles runner/plugin/ZIP.
- `public/brand/`, `public/downloads/`, `public/preview/`, `src/data/generated/`, `dist/`, `.artifacts/`: generated, ignored outputs.

The published site uses exactly the `html2figma` dependency version in this folder's package and lockfile, rather than the mutable root source. The converter and plugin renderer are bundled from that same installed package. The brand palette comes from `../docs/brand/README.md`.

## Preview behavior

User content is rendered in an opaque `sandbox="allow-scripts"` iframe. Only the controlled bundled runner is permitted by the iframe's CSP nonce. The runner sanitizes active HTML, removes user scripts/events and navigational links, applies CSS as text, waits for resources, then runs the published converter in the iframe's own DOM realm. The host validates every returned document and matches each message to its iframe and session.

Input is limited to 200 KB per editor. Editing immediately clears JSON and disables copy/download until a new conversion succeeds. Public images/fonts are allowed; failures/timeouts are reported separately. Conversion warnings are displayed without claiming complete CSS support. Viewport width defines the actual input viewport; oversized fixed CSS scrolls instead of changing the captured geometry.

Gallery JSON is produced from the same preview input, not separately maintained snapshots. `Examples.tsx` is rendered with React server rendering during asset preparation; each exported case includes shared and case-specific CSS. PNGs are checked-in assets, so builds need no browser. Run `node scripts/generate-case-art.mjs` to regenerate them from the owned SVG artwork. Images are embedded data URLs. Preset typography uses Geist; the renderer falls back to Inter if Geist is unavailable in Figma. The library's fallback font is distinct from the website's typography.

## Design and interaction verification

The UI uses shadcn Button, Card, Badge, Select, Tabs, Sheet, NavigationMenu, Accordion, Alert and Textarea. Mobile focus management and tab keyboard behavior come from the Radix primitives. `components.json` contains the registry/alias configuration; `src/styles/shadcn.css` maps its theme to the existing Figma palette.

The homepage converts its live example into the same validated JSON used by Playground and Gallery. The compact tree comes from that document; full diagnostics remain in Playground. Preview labels distinguish browser input from output that must be inspected in Figma.

`ConversionStory.tsx` uses a real Feature case to connect browser input, measured layer selection and an actual node JSON fragment. GSAP/ScrollTrigger pins the walkthrough only on desktop viewports at least 1024 px wide and 760 px high with normal motion preferences. On mobile, short screens and reduced motion, the shadcn Tabs remain keyboard-accessible without pinning. `useGSAP` and `matchMedia` revert the timeline on unmount and breakpoint changes. Native capture dimensions stay unchanged; only presentation wrappers animate.

Featured layout uses explicit primary/secondary classes rather than structural first-child selectors: Astro can inject hydration scripts before a card. Browser checks compare all card edges, preview bounds, source dimensions, scroll-driven steps, responsive cleanup and actual JSON fields.

Playground uses CodeMirror for HTML/CSS and read-only JSON, keyboard-accessible source/output tabs, persistent conversion/copy controls, a node summary and readable diagnostics. Source changes immediately invalidate previous output. Mobile navigation makes the background inert, traps Tab focus, closes with Escape and restores focus.

The website suite covers responsive home geometry at 390/768/1024/1440 px in both languages, menu focus, editor tabs, diagnostics, code-copy separation, six-case JSON export and the downloadable plugin render handler. Current walkthrough and grid evidence is saved under `.artifacts/taste-fixes/` by `home-story.spec.ts`. Run `node scripts/capture.mjs` after building to save other desktop/mobile evidence under `.artifacts/screenshots/`.

## Vercel

For Git deployments, import the **entire repository**, set Root Directory to `website`, enable inclusion of source files outside the root directory, choose Node 24.x, use `npm ci` / `npm run build`, and set output to `dist`. Asset preparation reads `../docs/brand`; include those brand files in Git builds. The website owns its examples and no longer reads the plugin test fixtures.

### Environments

The commands follow [Vercel's Development / Preview / Production environments](https://vercel.com/docs/deployments/environments). A Git push to `feature/site` should create Preview deployments; keep the project's production branch set to `master` in Vercel's Git settings. Local configuration does not change that remote setting.

| Task | Command | Environment / output |
| --- | --- | --- |
| Develop | `npm run dev` | Development, port 4321 |
| Build for QA | `npm run build:preview` | Preview static site in `dist/` |
| View the build | `npm run preview` | Serves existing `dist/` on port 4322; does not rebuild |
| Verify | `npm run verify` | Config tests, type checks, Preview build, isolated browser tests |
| Build normally | `npm run build` | Detects `VERCEL_ENV`; defaults to Production locally |
| Build Production explicitly | `npm run build:production` | Production static site in `dist/` |
| Deploy Preview | `npm run deploy` | Pull Preview config → Vercel build → prebuilt Preview upload |
| Deploy Production explicitly | `npm run deploy:production` | Pull Production config → Production build → Production upload |

All builds use the same `dist/` directory: the last build wins. `preview` is a local HTTP server, while `deploy` creates a remote Preview deployment. Development and Preview pages carry `noindex,nofollow` and use Analytics development mode; only Production collects real traffic.

### Environment variables

Copy `.env.example` to `.env.development.local`, `.env.preview.local` or `.env.production.local`, or pull the corresponding Vercel variables:

```sh
# First use only: log in, then link this folder to the existing project.
npm exec --yes --package=vercel@63.1.2 -- vercel login
npm exec --yes --package=vercel@63.1.2 -- vercel link --project html2figma

npm run env:development
npm run env:preview
npm run env:production
```

Preview pulls include the current Git branch, so branch-specific values apply. These commands overwrite only their named ignored files. Standard dotenv precedence applies: process values override mode-specific local files, then mode files, `.env.local`, and `.env`. Keep `.env.local` for truly shared values; move old environment-specific values into the corresponding file. Never commit secrets or use a `PUBLIC_` prefix for them.

`SITE_URL` is an optional public HTTP(S) origin for canonical/hreflang/OG URLs. It is loaded before Astro evaluates the configuration. Defaults are `http://127.0.0.1:4321` for Development, `VERCEL_URL` for hosted Preview when available, and the existing production origin otherwise. Local Preview/prebuilt builds without a deployment URL use the production origin with `noindex`; use an explicit Preview `SITE_URL` if you need that domain in metadata. Set Production `SITE_URL` when adopting a custom domain. `SITE_ENV` is controlled by the npm scripts; do not put it in dotenv.

### Prebuilt deployment

```sh
npm run vercel:build             # Pull + build Preview locally; no upload
npm run deploy                  # Rebuild and upload Preview
npm run deploy:production       # Rebuild and upload Production explicitly
```

The helpers use pinned Vercel CLI 63.1.2 through `npm exec`, keeping deployment tooling out of the site's CI dependency install. Login is stored by the CLI, not in this repository. [Vercel recommends `pull` before `build`](https://vercel.com/docs/cli/build); the helper follows that sequence on every build. Build/deploy helpers run the CLI from the repository root so Vercel's `website` Root Directory is applied once. They mirror the existing project identity into an ignored root `.vercel/` cache, preserve links to other projects, and stop if the remote Root Directory is incorrect. Vercel's root `.vercel/.env.<target>.local` files serve `vercel build`, whereas the website dotenv pull commands above serve plain Astro commands. Both stay ignored. A failed pull or build stops the upload.

`vercel.json` defines `npm ci`, the Astro build, `dist/` output and static headers. After the CLI build, `scripts/prepare-vercel.mjs` packages the Astro static pages and extensionless routes into the root Build Output API directory, preserving CLI project/target metadata. This also handles local monorepo builders that finish without collecting static files. A missing homepage stops deployment. All remote deployments require an already linked project. Local QA does not need a Vercel account.

## Adopt a new library release

1. Pin the newly released version with `npm install html2figma@X.Y.Z --save-exact`.
2. Update matching version references and behavior in both language documentation sets.
3. Review cases against that released version and run `npm run verify`.
4. Deploy the verified site. Plugin packaging and documentation version references are derived from the pinned package.

Do not point the public site at `file:..` or deploy unreleased library behavior. Development previews can be used to test draft changes separately. Add a real Community URL only after the plugin is published; the development installation guide remains available.

## Plugin acceptance

The built ZIP's `main.js` includes its UI and does not need a localhost server. Automated tests exercise a site-generated document through the downloaded bundle using a Figma API test double. Do not treat the test double as real visual acceptance.

On 2026-10-10, before the example redesign, the exact downloaded bundle's render handler was additionally executed against real Figma APIs with the original site-generated Hero document. It created nine nodes including four editable text nodes, with zero warnings. The test harness replaced UI/notification interfaces while real Figma handled scene creation. A screenshot was inspected and the temporary acceptance container was removed. This does not test the desktop plugin installation menu; importing `public/downloads/plugin/manifest.json` remains the manual installation smoke check.
