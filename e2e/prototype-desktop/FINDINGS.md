# Feasibility verdict: bounded API PASS; desktop repeatability PARTIAL

Observed 2026-09-23 on macOS 26.6.2 and Figma 126.8.18. Canonical specification:
https://github.com/Natumsol/html2figma/issues/1

The user explicitly changed the desired interaction to hidden-UI plugin commands
because foreground automation interfered with their work. All subsequent real
execution used a local API command, with no simulated clicks or keyboard input.
This change does not make an API run evidence for UI controls.

## What passed

The user completed the first development-plugin import. A real desktop run then
launched the named plugin through its Development menu and exercised both the
actual file input and clipboard → Validate → Render paths. Both invoked the
current public renderer and exported fresh 320 × 180 PNGs with zero warnings.
Their roots are `13:3` (file) and `13:9` (paste), inside owned area `13:2`.

After the user's direction change, the user launched the imported plugin.
A fixed `render-geometry` command queued at localhost was claimed by its hidden
UI transport, rendered using the same public renderer, and returned another
real 320 × 180 PNG with zero warnings. Root `13:16` and descendants through
`13:21` are inside owned area `13:15`. The returned API observation confirms
`hiddenUI: true` and identical before/after selection, viewport center and zoom.
There was exactly one API render result. A later ready handshake did not replay
the consumed task; it is not a second independent successful run.

All three PNGs pass the repository's Playwright comparator with threshold 0.2
and maxDiffPixelRatio 0.001; thresholded differing pixels are zero. The earlier
UI PNG raw RGBA comparison found 169 unequal pixels, so this is not a claim of
byte-for-byte or unthresholded pixel equality with the browser reference.

## Limits and observed failures

- A second independent native run stopped at the Go to Folder field timeout,
  before rendering. Repeatable desktop automation and full eight-case acceptance
  remain unproven. Do not run the foreground driver again without an explicit
  user request.
- This is hidden-UI execution inside a running Figma plugin. Figma and the target
  document must remain available; it is not a standalone headless Figma engine.
- The command is one fixed sample per receiver session. There is no arbitrary
  JS execution, general task queue, reconnect/retry policy or production Bridge.
- The observed Developer VM message origin is `https://www.figma.com`, but its
  source is not `parent`. The bridge checks that origin and current run identity.
- Concurrent result/observation delivery in the successful API run overwrote
  some individual event journal filenames (10 files for 12 state events). The
  final state contains both result metadata and viewport observation; the PNG
  was saved and compared. Source now serializes bridge delivery. That follow-up
  change passed packaging/syntax checks and a fresh read-only ready handshake
  (`4a49f9b2-6e8d-43bd-b710-e1483721f36f`); no command was queued and no new
  render was attempted. It is not a durable multi-client journal implementation.
- Earlier UI result metadata omitted SVG-internal vector IDs. A subsequent
  read-only handshake recovered complete owned area descendants `13:3` through
  `13:14`. Source now enumerates all descendants.
- Initial macOS consent and first import gates were resolved by the user.
  Historical node `6:2` disappeared between snapshots; the user explicitly
  confirmed manually deleting/moving it. The prototype did not delete nodes.

## Local evidence

Paths below are relative to the worktree unless absolute. Generated files,
credentials and raw desktop screenshots are intentionally excluded from Git.

| Evidence | Location |
| --- | --- |
| Actual file/paste results, PNGs, comparison | `test-results/desktop-prototype/5a4ee817-67e0-4484-b946-0b5439db901e/` |
| Failed independent native repeat, descendant audit | `test-results/desktop-prototype/a28afc5b-6b6f-41cc-8a86-8164ec9e7613/` |
| Actual API result, PNG, viewport observation, comparison | `test-results/desktop-prototype/83a8f90d-9f64-4c9f-af47-7db3e057e9a9/` |
| Browser sample and reference PNG | `/var/folders/66/3836bqd96t361t9r1zjz143c0000gn/T/html2figma-desktop-sample-IfYVkW/` |
| Full local verification log | `/tmp/html2figma-desktop-prototype-final-verify.log` |

The renderer SHA-256 in all three result receipts is
`ad8dba50d31b59526a8806a3c4f1c6f828fa05ac8af58417a95050882db71a61`.
The receiver checks the exact prepared document, run identity, renderer hash,
task identity in API mode, PNG signature and reported dimensions. The plugin
checks the exact acceptance file key before any write. Evidence includes the
actual exported bytes, not reconstructed or mock Figma output.

`npm run verify:all` passed: 44 core, 12 example, 33 browser and 15 built UI E2E
tests, with typechecks, boundary checks, isolated consumers and builds. Those
checks are separate from live Figma observations. Swift helper compilation and
JavaScript syntax checks passed. No Figma MCP was used.

Only owned local receivers were stopped after evidence capture. All prototype
canvas areas remain for inspection. No product code, full runner, implementation
tickets or merge to the product branch are part of this throwaway experiment.
