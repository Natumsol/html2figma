---
title: Troubleshooting
description: Resolve preview, clipboard, resource and Figma import problems.
order: 7
---

## JSON copy is disabled

Wait for the preview to load, then convert. Editing HTML, CSS or viewport width invalidates the old result. Convert again before copying. Gallery buttons become available after the corresponding preset converts.

If clipboard access fails, download JSON from the Playground or select the result text and copy it manually. Use a secure website context or localhost for clipboard access.

## The preview is empty

Add visible HTML. Check for `display: none`, `visibility: hidden`, zero-size containers and CSS requiring external resources. User JavaScript is intentionally disabled; create the desired markup directly.

Inputs are limited to 200 KB each. If external resources fail or exceed the loading timeout, the diagnostics area shows a resource warning. Public image/font servers may reject cross-origin or anonymous requests.

## Figma rejects the JSON

Copy the full document, including `version`, `root`, `resources`, `warnings` and `metadata`. Do not copy only a subtree. The companion plugin uses the same library version as the site and validates all incoming documents.

## Text looks different

Check the render warning list for `font-load-failed`. Install the requested font in an environment Figma can access. If the font is available, line wrapping or browser/Figma text metrics can still differ.

## Images are missing

Check that URLs are public and reachable from the plugin. Relative paths must resolve to an accessible site, not a local-only development server. Browser cookies do not transfer to Figma. Embedded data URLs can help make image resources portable.

## Layout looks different

Inspect conversion warnings and the [support table](/docs/support/). Grid, transforms, wrapping and complex inline layout can differ. The library captures a fixed viewport, not responsive constraints.

## Report a reproducible issue

Include the library version, a minimal HTML/CSS example, viewport size and both conversion/render warnings in a [GitHub issue](https://github.com/Natumsol/html2figma/issues). Remove private content and credentials before sharing a JSON document.
