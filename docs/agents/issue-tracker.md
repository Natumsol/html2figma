# Issue tracker: GitHub

Issues and PRDs live in GitHub Issues for `Natumsol/html2figma`.
Use the `gh` CLI from this clone. Outside the clone, specify
`--repo Natumsol/html2figma` for issue and PR commands.

## Conventions

- Create: `gh issue create --title "..." --body-file <path>`.
- Read: `gh issue view <number> --comments`.
  Fetch structured fields and labels with `--json` when needed.
- List: `gh issue list --state open --json number,title,body,labels,comments`.
  Apply label and state filters as needed.
- Comment: `gh issue comment <number> --body-file <path>`.
- Apply labels: `gh issue edit <number> --add-label "<label>"`.
- Remove labels: `gh issue edit <number> --remove-label "<label>"`.
- Close: `gh issue close <number>`.

For multiline bodies, write the exact text to a temporary file and use
`--body-file`. Use the vocabulary in `docs/agents/triage-labels.md`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

If enabled later, use the equivalent `gh pr` operations and the same
triage labels. Include external contributors' PRs; exclude PRs authored
by repository owners, members, and collaborators.

Issues and PRs share a number space. When a reference is ambiguous,
resolve its type before acting.

## Skill instructions

When a skill says "publish to the issue tracker", create a GitHub issue.
When it says "fetch the relevant ticket", read the issue and its comments.

## Wayfinding operations

- Map: one issue labelled `wayfinder:map`, containing Notes,
  Decisions-so-far, and Fog.
- Child tickets: link as GitHub sub-issues. If unavailable, maintain a
  task list in the map and put `Part of #<map>` in each child.
- Ticket types: `wayfinder:research`, `wayfinder:prototype`,
  `wayfinder:grilling`, or `wayfinder:task`.
- Blocking: use GitHub's native issue dependencies. If unavailable,
  record `Blocked by: #<number>` references in the child.
- Frontier: choose the first open, unassigned child in map order whose
  blockers are all closed.
- Claim: assign the ticket to the driving developer.
- Resolve: comment with the result, close the child, and append a brief
  result and link to the map's Decisions-so-far.
