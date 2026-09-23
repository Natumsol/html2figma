# Feasibility verdict: BLOCKED

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
