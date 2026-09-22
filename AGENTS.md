# Repository Guidelines

## Project Structure & Module Organization

- `src/convert.ts` and `src/convert/`: browser-side DOM traversal, style extraction, layout metadata, resources, and warnings.
- `src/render.ts` and `src/render/`: Figma plugin rendering, adapter abstraction, node creation, and style application.
- `src/schema/types.ts`: shared public AST, warning, resource, option, and result types.
- `src/utils/`: focused CSS/font/warning helpers.
- `tests/unit/`: Vitest unit tests for schema, utilities, and render adapter behavior.
- `tests/browser/`: Playwright tests for browser-backed conversion behavior.
- `tests/fixtures/`: HTML/CSS fixtures used by browser tests.
- `docs/superpowers/`: design and implementation planning notes.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run typecheck`: run TypeScript checking with `tsc --noEmit`.
- `npm run test`: run all Vitest unit tests.
- `npm run test:browser`: run Playwright browser conversion tests.
- `npm run build`: build ESM, CJS, and declaration outputs with `tsup`.
- `npm run verify`: run typecheck, unit tests, and build.

Browser tests start a local Vite server through Playwright. In restricted environments, they may need permission to bind `127.0.0.1`.

## Coding Style & Naming Conventions

Use strict TypeScript and ES modules. Keep files small and responsibility-focused: conversion under `src/convert/`, rendering under `src/render/`, shared types under `src/schema/`, and pure helpers under `src/utils/`.

Use two-space indentation, named exports, descriptive function names, and explicit public types. Prefer structured CSS parsers/helpers over ad hoc string handling. Keep runtime boundaries clean: convert code must not depend on Figma globals, and render code must not depend on DOM APIs.

## Testing Guidelines

Use Vitest for unit tests and Playwright for browser-dependent layout/style behavior. Name tests by behavior, such as `color.test.ts`, `render.test.ts`, or `convert.spec.ts`.

Add unit tests for pure parsing, mapping, and warning behavior. Add browser tests when behavior depends on `getComputedStyle()` or `getBoundingClientRect()`. Before handoff, run `npm run verify` and `npm run test:browser`.

## Commit & Pull Request Guidelines

Follow the existing conventional commit style: `feat:`, `fix:`, `test:`, `docs:`, and `chore:`. Keep commits focused, such as `feat: convert browser DOM to AST`.

Pull requests should include a short summary, test results, and any known limitations. Link related issues when available. For rendering or conversion changes, mention whether browser tests, unit tests, or both were updated.

## Agent-Specific Instructions

Do not commit generated `dist/`, `node_modules/`, or `test-results/`. Preserve the package entrypoint separation in `package.json`: root schema exports, `./convert`, and `./render`.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `Natumsol/html2figma`.
See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels.
See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context layout: root `CONTEXT.md` and `docs/adr/`.
See `docs/agents/domain.md`.
