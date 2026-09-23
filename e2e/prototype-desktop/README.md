# THROWAWAY: real Figma desktop feasibility probe

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
reports or a completely automated desktop sequence.
