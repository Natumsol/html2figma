import { convert } from "html2figma/convert";
import type { CaptureTarget, ExtensionMessage } from "../shared/messages";

let active = false;
let hovered: HTMLElement | undefined;

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === "convert-page") {
    completeConversion(document.body, "page");
  }

  if (message.type === "start-selection") {
    startSelection();
  }

  if (message.type === "cancel-selection") {
    stopSelection();
  }
});

function startSelection(): void {
  if (active) {
    return;
  }

  active = true;
  document.addEventListener("mouseover", onMouseOver, true);
  document.addEventListener("mouseout", onMouseOut, true);
  document.addEventListener("click", onClick, true);
}

function stopSelection(): void {
  active = false;
  clearHover();
  document.removeEventListener("mouseover", onMouseOver, true);
  document.removeEventListener("mouseout", onMouseOut, true);
  document.removeEventListener("click", onClick, true);
}

function onMouseOver(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  clearHover();
  hovered = target;
  hovered.dataset.html2figmaPreviousOutline = hovered.style.outline;
  hovered.style.outline = "2px solid #38bdf8";
}

function onMouseOut(): void {
  clearHover();
}

function onClick(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();

  const selected = hovered;
  stopSelection();

  if (selected) {
    completeConversion(selected, "selection");
  }
}

function clearHover(): void {
  if (!hovered) {
    return;
  }

  hovered.style.outline = hovered.dataset.html2figmaPreviousOutline ?? "";
  delete hovered.dataset.html2figmaPreviousOutline;
  hovered = undefined;
}

function completeConversion(element: HTMLElement, target: CaptureTarget): void {
  chrome.runtime.sendMessage({
    type: "conversion-complete",
    target,
    document: convert(element)
  });
}
