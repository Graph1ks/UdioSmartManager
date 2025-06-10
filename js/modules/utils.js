// js/modules/utils.js

import { UPM_UI_PREFIX, USPM_UI_PREFIX } from "@/modules/config.js";

/**
 * Creates a Material Symbols span element.
 * @param {string} iconName - The name of the Material Symbol.
 * @param {string} extraClass - Any additional CSS classes to add.
 * @returns {HTMLSpanElement} The created icon span element.
 */
export function createIcon(iconName, extraClass = "") {
  const span = document.createElement("span");
  span.className = `material-symbols-outlined ${UPM_UI_PREFIX}-icon ${USPM_UI_PREFIX}-icon ${extraClass}`;
  span.textContent = iconName;
  return span;
}

/**
 * Creates a debounced function that delays invoking `func` until after `delay` milliseconds have passed.
 * @param {Function} func - The function to debounce.
 * @param {number} delay - The number of milliseconds to delay.
 * @returns {Function} The new debounced function.
 */
export function debounce(func, delay) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

/**
 * Dispatches a custom event to the page's main world to apply a preset.
 * This is required to bypass the content script's isolated world and access React's event handlers.
 * @param {HTMLInputElement|HTMLTextAreaElement} inputElement - The target input element.
 * @param {string} valueToSet - The value to apply to the input.
 * @param {string} managerId - The ID of the manager calling this function.
 * @param {object} logger - The logger instance.
 */
export function applyReactControlledInputPreset(
  inputElement,
  valueToSet,
  managerId,
  logger
) {
  if (!inputElement) {
    logger.warn(`[${managerId}] Target input not found for event dispatch.`);
    return;
  }

  const tempId = `upm-target-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  inputElement.id = tempId;

  const detail = {
    tempId,
    valueToSet,
    managerId,
  };

  document.dispatchEvent(new CustomEvent("upm:applyPreset", { detail }));

  // The injected script will remove the ID, but as a fallback, we do it here too.
  setTimeout(() => {
    const el = document.getElementById(tempId);
    if (el) {
      el.removeAttribute("id");
    }
  }, 500);
}
