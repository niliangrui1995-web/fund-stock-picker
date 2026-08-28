const keyboardNavigationKeys = new Set([
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

function isKeyboardNavigationEvent(event: KeyboardEvent): boolean {
  return !event.altKey && !event.ctrlKey && !event.metaKey && keyboardNavigationKeys.has(event.key);
}

export function installInputModalityTracking(root: HTMLElement = document.documentElement): () => void {
  const markPointer = () => {
    root.dataset.inputMode = "pointer";
  };
  const markKeyboard = (event: KeyboardEvent) => {
    if (isKeyboardNavigationEvent(event)) root.dataset.inputMode = "keyboard";
  };

  document.addEventListener("pointerdown", markPointer, true);
  document.addEventListener("keydown", markKeyboard, true);
  return () => {
    document.removeEventListener("pointerdown", markPointer, true);
    document.removeEventListener("keydown", markKeyboard, true);
  };
}
