# Feasibility verdict: PARTIAL — awaiting first plugin import

## Resumed run, 2026-09-23 07:42 UTC

The user asked to continue. System Events now reports UI accessibility enabled
(`true`); the prior consent gate is resolved. Opening the exact acceptance file
via `open -a Figma figma://file/3bfxbSZ7K2URZ3Aak50Wwd` exposed the real
`html2figma E2E 画布验收` editor. Native AX inspection read its Page 1 and five
historical top-level layer names (media, geometry, typography, flex-border,
geometry). A label-driven click opened Main menu and revealed Plugins.

Window enumeration initially returned zero and later the correct editor. Some
ad hoc inspection failures (`-10000`) were caused by using AppleScript's `rows`
term as a variable; the saved helper uses `outputRows`. Do not misclassify those
script errors as a Figma access restriction. Native traversal also exceeded a
30-second bound; a subsequent compact inspection succeeded with a 45-second
bound, but a label-driven Plugins click also timed out at 45 seconds. A timed-out
click is not proof that a menu was opened. Repeatability
remains unproven.

Prepared a separate `html2figma Desktop Prototype` build and local result
receiver; see README for the concrete manual import path and run command.
The unchanged product UI and product plugin handler are bundled with the actual
renderer; additions only guard/isolate/observe/export. The build succeeded and
`node --check` passed for the generated plugin. The receiver has no ready/result
events yet. These are prepared artifacts, not exercised Figma functionality.

Issue #1 explicitly assigns first plugin import to the user. The concrete
manifest is ready and the user has been asked to import it. Continue by observing
the registered plugin, launching that exact name, checking its read-only ready
event/file key, and driving both actual import paths. No user response to the
import request had arrived when this checkpoint was written.

`npm run verify:all` passed again: 44 core, 12 example, 33 browser and 15 built UI
E2E tests. No real import, render, PNG export, localhost receipt, or node creation
has occurred. The full feasibility gate is still open; this checkpoint proves
only native app/file opening and partial AX menu access. All baseline nodes were
left untouched. No Figma MCP was used.

## Initial run (historical BLOCKED result)

Observed 2026-09-23 on baseline `85c23ff`. Canonical specification:
https://github.com/Natumsol/html2figma/issues/1

The end-to-end desktop question remains unanswered. A native macOS consent
dialog visibly requested that **ChatGPT** control **System Events**. Consent was
not automated. Do not interpret this as evidence that AppleScript cannot operate
Figma, or as successful validation of the proposed desktop architecture.

## Observations

- macOS 26.6.2 (25G83); installed/running Figma 126.8.18.
- `osascript -e 'tell application "System Events" to get UI elements enabled'`
  timed out with AppleEvent error `-1712`. A bounded diagnostic invocation also
  timed out after 15 seconds and recorded `ETIMEDOUT` / `SIGTERM`.
- A desktop screenshot succeeded and confirmed the pending consent dialog.
  It contains unrelated desktop content and remains local, outside Git.
- Live Figma window accessibility, login, development-plugin registration,
  target file identity/edit permission, and actual iframe accessibility remain
  unknown. No target file was opened or changed by this run.
- Neither real import path, actual Figma render, PNG export nor localhost
  receipt was exercised. Created node IDs: `[]`. Real Figma PNG: none.
- The acceptance file URL was identified from the existing acceptance record;
  historical nodes and screenshots were not used as fresh verification.

## Local-only verification

- `npm ci --no-audit --no-fund` and equivalent `--prefix example`: exit 0.
- `npm run verify:all`: exit 0; 44 core tests, 12 example tests, 33 browser tests,
  15 built UI E2E tests; typechecks, boundary/consumer checks and builds passed.
  The existing E2E Figma test double does not prove real desktop execution.
- `npm run prototype:figma:probe`: exit 2 (BLOCKED, expected).
- `npm run prototype:figma:sample`: exit 0. Current browser `147.0.7727.15`
  converted the existing geometry fixture and saved JSON, browser PNG and
  converter/renderer/input SHA-256 values. No Figma result was synthesized.
- Port 5173 was free before preparation and after shutdown. Only owned local
  services and probe processes were stopped; Figma was left running.
- No new tests, production Bridge, plugin modifications or implementation
  tickets were added. Prototype scripts and these findings live only on the
  throwaway branch; no product branch was merged.

## Resume gate and specification implications

The user must click **Allow** on the observed **ChatGPT → System Events** dialog.
If it was dismissed/denied, inspect System Settings → Privacy & Security →
Automation → ChatGPT → System Events. Accessibility may also need authorization,
but its current state is unknown; do not claim it is denied without observing it.

After the user acts, explicitly rerun the probe. Then verify the actual target
file and named development plugin before any canvas writes. Only then prepare
the isolated plugin observation/export additions and exercise file import and
paste/validate/render through the real controls. Retain created IDs and require
fresh PNG receipt before calling either path successful.

Keep issue #1's startup-feasibility gate open. The actual responsible host in
the consent UI is ChatGPT, even though this task runs in Codex; setup guidance
must use the name macOS actually displays. Neither repeatability nor the full
first-stage feasibility acceptance has passed. Do not relax the UI boundary or
substitute direct AST injection to close this gate.

Machine-readable observations, screenshots and sample artifacts are referenced
by the OS-temporary return handoff. They are intentionally not public artifacts.
