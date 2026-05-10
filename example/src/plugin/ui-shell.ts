export function createUiShellHtml(uiDevUrl: string): string {
  const iframeUrl = escapeHtml(uiDevUrl);
  const iframeOriginJson = JSON.stringify(readOrigin(uiDevUrl));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <style>
      html,
      body,
      iframe {
        width: 100%;
        height: 100%;
        margin: 0;
        border: 0;
        overflow: hidden;
      }

      body {
        background: #0f172a;
      }
    </style>
  </head>
  <body>
    <iframe src="${iframeUrl}" title="html2figma example UI"></iframe>
    <script>
      const allowedOrigin = ${iframeOriginJson};
      window.addEventListener("message", (event) => {
        if (event.origin !== allowedOrigin) {
          return;
        }

        if (!event.data || typeof event.data !== "object" || !("pluginMessage" in event.data)) {
          return;
        }

        parent.postMessage(event.data, "*");
      });
    </script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function readOrigin(value: string): string {
  const match = value.match(/^(https?:\/\/[^/]+)/);
  if (!match) {
    throw new Error(`Invalid iframe URL: ${value}`);
  }

  return match[1];
}
