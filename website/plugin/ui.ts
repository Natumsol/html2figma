import { parseDocumentJson } from 'html2figma';
const input = document.querySelector<HTMLTextAreaElement>('#json')!;
const button = document.querySelector<HTMLButtonElement>('#render')!;
const status = document.querySelector<HTMLElement>('#status')!;
let busy = false;
button.addEventListener('click', () => {
  if (busy) return;
  try {
    const document = parseDocumentJson(input.value);
    busy = true;
    button.disabled = true;
    input.disabled = true;
    status.textContent = 'Rendering / 正在生成图层…';
    parent.postMessage({ pluginMessage: { type: 'render', document } }, '*');
  } catch (error) { status.textContent = error instanceof Error ? error.message : 'Invalid JSON'; }
});
window.addEventListener('message', event => {
  if (event.source !== parent) return;
  const message = event.data.pluginMessage;
  if (!message || !['done', 'error'].includes(message.type)) return;
  busy = false;
  button.disabled = false;
  input.disabled = false;
  status.textContent = message.type === 'error' ? message.message : `Created ${message.nodes} layers / 已生成 ${message.nodes} 个图层.\n${JSON.stringify(message.warnings, null, 2)}`;
});
