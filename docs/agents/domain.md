# Domain Docs

This repository uses a single-context layout.

## Before exploring, read these

- Root `CONTEXT.md` for domain terms and context.
- Relevant ADRs under `docs/adr/` for decisions affecting the work.

If these files do not exist, proceed silently. Do not flag their absence
or suggest creating them upfront. The `domain-modeling` skill creates
them lazily when terms or decisions are resolved.

## File structure

- `CONTEXT.md`: repository-wide domain context and glossary.
- `docs/adr/NNNN-<decision>.md`: architecture decision records.

Existing documents under `docs/superpowers/` remain design and
implementation planning references.

## Use the glossary's vocabulary

Use terms defined in `CONTEXT.md` in issue titles, proposals, hypotheses,
and test names. Avoid synonyms the glossary explicitly rejects.

When a needed concept is missing, reconsider whether it belongs to the
domain. Note genuine gaps for `domain-modeling`.

## Flag ADR conflicts

If a proposal contradicts an existing ADR, identify the ADR and explain
why the decision should be revisited rather than silently overriding it.
