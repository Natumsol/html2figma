---
title: Companion plugin
description: Download the standalone plugin, paste JSON and create editable layers.
order: 5
---

## Install the development plugin

Download the plugin ZIP above. It includes `manifest.json`, `main.js`, a readme and the MIT license. The interface is bundled into `main.js`; no local web server is required.

1. Unzip the package into a permanent local folder.
2. Open a Figma Design file in the Figma desktop application.
3. Use **Plugins → Development → Import plugin from manifest** and select `manifest.json`.
4. Run **html2figma 1.0.2** from the Development plugin list.

Menu names can vary by Figma language or application version. This is a development plugin, not a published Community plugin. You need development-plugin access in your Figma environment.

## Import from the site

1. Pick a [Gallery case](/gallery/) or convert your HTML/CSS in the [Playground](/playground/).
2. Choose **Copy JSON**.
3. Paste into the plugin's **Import JSON** field.
4. Choose **Render to Figma**. The plugin validates JSON, creates layers, selects the result and moves the viewport to it.

The plugin reports render warnings. Rendering a second time creates another set of layers; it does not update an existing import.

## Images and fonts

The companion plugin allows external network access to load public images referenced in JSON. Failed requests can produce missing fills and warnings. Use embedded data URLs when you need self-contained image data.

Install required fonts so Figma can use them. Missing fonts fall back to Inter. Gallery previews use Geist; install Geist for closer text metrics or expect fallback differences. Web fonts in your CSS do not get installed by the plugin.

## Updating the plugin

When a new library release is adopted by the site, download the matching plugin package and reimport its manifest if needed. Keep the plugin version aligned with the site version.

## Community release

A Community version is planned. This site currently offers the standalone development plugin. It does not present an unverified Community installation link.
