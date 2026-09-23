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

This deliberately small first-stage artifact does not open or edit Figma files,
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
