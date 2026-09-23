# THROWAWAY: real Figma desktop feasibility probe

**Current user preference:** continue with the hidden-UI API mode below. Do not
run the foreground desktop driver unless the user explicitly asks to return to
UI automation. Both real import paths have already been exercised once; that
evidence remains separate from API-only rendering.

## Hidden-UI API mode

```sh
npm run prototype:figma:api -- /absolute/path/to/geometry.document.json
```

The existing imported manifest path/name is reused. The user launches the plugin
once in the acceptance file after this build; then they can switch to other
work. The plugin UI is hidden (`visible: false`). The Figma desktop engine and
the target document must remain available: this is headless plugin execution,
not a standalone replacement for Figma's rendering engine.

The run's ignored `control.json` contains the local command URL. POST exactly
`{"type":"render-geometry"}` to queue the one permitted task. The hidden plugin
claims it after a verified handshake, invokes the actual renderer directly and
exports PNG through the existing observer. It does not select nodes or change
the viewport. Before/after selection and viewport are reported as evidence.
There is no keyboard, menu, pointer or file-dialog automation in this mode.

Use the fixed-command helper with the output directory printed at startup:

```sh
npm run prototype:figma:command -- /absolute/path/to/run-output-directory
```

The helper queues the sample without printing the session credential. See
[FINDINGS.md](./FINDINGS.md) for observed results and the remaining limits.

The random command URL is a local session credential: do not publish it. The
fixed command does not accept JS, an arbitrary document or a general action.
A claimed task is never automatically retried/requeued; a new session requires
an explicit restart after observing the prior outcome. This bounded prototype
supports one sample command per session, not a production task queue.

API execution is explicitly **not** evidence for file input, paste or validation
controls. Preserve the separately captured real UI result when reporting scope.

Question: can an observed macOS desktop sequence open the designated acceptance
file, launch a specifically named development plugin, operate the actual file
input and paste/validate/render controls, and receive a freshly exported PNG at
localhost? This follows the logic/state branch of the prototype skill. A desktop
permission gate must succeed before testing the rest of the state transitions.

Run from the repository root:

```sh
npm run prototype:figma:probe
```

The probe prints the full state after each read-only observation and writes
`state.json` in a unique OS temporary directory. Every AppleScript invocation has
a 15-second bound. Exit code 2 means the complete feasibility question is still
unproven. An accessibility success is only PARTIAL, never a real E2E pass.

The probe command does not open or edit Figma files,
register plugins, synthesize imports, or change system permissions. It never
retries a desktop action. Consent prompts must be handled by the user. No Bridge
or fake render is used to claim desktop success. The coverage flags remain false
until a separate actual desktop run can provide evidence.

Canonical contract: https://github.com/Natumsol/html2figma/issues/1

The historical file URL comes from `e2e/visual/ACCEPTANCE.md`; it is not live proof
of file identity or edit permission. Existing nodes must remain untouched.
Raw window titles and desktop screenshots belong in local evidence, not Git.

To prepare just one local browser sample after installing root/example
dependencies and building the examples, run `npm run prototype:figma:sample`.
It uses the existing geometry fixture and actual converter, saving JSON, a
browser reference PNG and hashes in an OS temporary directory. It does not
create a Figma PNG or prove any desktop stage. The existing local server uses
port 5173 and fails on conflict; it never kills an existing port owner.

## Native UI observation and prototype plugin

After the one-time plugin import, run the entire one-sample desktop experiment:

```sh
npm run prototype:figma:run -- /absolute/path/to/geometry.document.json
```

Prerequisites: current root/example builds, Figma running with the acceptance
file accessible, first-time Automation/Accessibility grants, and the prototype
manifest already imported. Close a completed prior prototype plugin before a
new run. Never reopen or retry an uncertain render. This command compiles the
tiny Swift AX helper, starts its own receiver, opens the exact file, launches the
exact named plugin through Development, and drives the actual file picker and
clipboard paste UI paths. It waits for observed state and PNG receipt after each
render, then stops only its own receiver. Layers and the plugin stay visible.

`ax.swift` uses public macOS Accessibility APIs to avoid slow AppleEvent property
loops. Every action checks the observed path, role and label. Paste uses a real
clipboard plus Command-A/Command-V events addressed to Figma, verifies the field,
and restores clipboard data. AppleScript drives only the guarded native picker
shortcuts. There are no coordinates, browser DOM injection or Figma MCP calls.
The source restriction for replies is the observed `https://www.figma.com`
origin plus run identity; a strict `event.source === parent` check does not work
in the observed Developer VM nesting. The temporary driver uses Chinese file
picker labels, so it is not yet portable across UI languages.

`node e2e/prototype-desktop/ax.mjs inspect` records the real Figma accessibility
tree in OS temp. `node e2e/prototype-desktop/ax.mjs click AXMenuItem Plugins`
clicks an observed label only when exactly one match exists in the acceptance
window. Run clicks only after observing the relevant control. It sends no global
keystrokes. Traversal is slow and bounded at 45 seconds; a timeout does not prove
the click happened. Do not infer success or blindly repeat a timed-out action.

After local builds, start the throwaway plugin receiver with the sample path:

```sh
npm run prototype:figma:serve -- /absolute/path/to/geometry.document.json
```

This builds a separately named `html2figma Desktop Prototype` and serves the
unchanged, built product UI at localhost:5173. First import is manual, as required
by issue #1: Figma Plugins → Development → Import plugin from manifest, choosing
`test-results/desktop-prototype/plugin/manifest.json` in this worktree. The
registration path stays constant; each invocation creates fresh run evidence.
Run the serve command only once at a time, and stop it before `verify:all`, since
the existing browser/E2E checks also own port 5173.

The prototype bundles the actual product plugin entry. A render-import wrapper
checks the expected file key and exact prepared document, creates a named owned
frame, and delegates to the current built public renderer. It exports a real PNG
only after a real UI import invokes rendering. Each source (`file`, `paste`) is
accepted once per plugin session; reopening the plugin is not an automatic retry.
Do not reopen it after an uncertain render. The original import/validate/render
UI is unchanged. Blocks rendering is disabled in the prototype entry.

The shell reports readiness and observed results to a random local endpoint. The
receiver validates current run/input/renderer identity and PNG dimensions, saving
events and images below `test-results/desktop-prototype/<runId>/`. It exposes no
task injection or arbitrary execution endpoint. All generated bundles/manifests,
credentials, screenshots and events are ignored by Git. On failure or uncertainty,
retain created nodes and inspect the reported IDs; this prototype never deletes
canvas nodes. A local build or empty receiver log is not real Figma evidence.

This is a feasibility artifact, not the production Bridge or complete runner.
It does not implement full protocol checks, run locks, eight cases, cleanup,
reports or the eight-case acceptance sequence.
