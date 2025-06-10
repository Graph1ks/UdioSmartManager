// js/page_context_script.js

(() => {
  /**
   * This function runs in the page's main world context, allowing it to interact
   * with the page's own JavaScript, including React's event system.
   */
  const applyReactPresetInPageContext = async (
    inputElement,
    valueToSet,
    managerId
  ) => {
    if (!inputElement) return;

    // Handle contenteditable for LyricVault
    if (inputElement.isContentEditable) {
      // Sanitize line breaks and create HTML paragraphs
      const newHtml = valueToSet
        .split("\n")
        .map((line) => `<p>${line.trim() || "<br>"}</p>`)
        .join("");

      inputElement.innerHTML = newHtml;

      // Dispatch an input event to let React know the content has changed.
      inputElement.dispatchEvent(
        new Event("input", { bubbles: true, cancelable: true })
      );
      return;
    }

    let reactPropsKey = null;
    for (const key in inputElement) {
      if (key.startsWith("__reactProps$")) {
        reactPropsKey = key;
        break;
      }
    }

    const isStyleReductionCMDK =
      managerId &&
      managerId.toLowerCase().includes("style-reduction") &&
      inputElement.hasAttribute("cmdk-input");

    if (
      !reactPropsKey ||
      !inputElement[reactPropsKey] ||
      typeof inputElement[reactPropsKey].onChange !== "function"
    ) {
      console.warn(
        "[UdioSmartManager PageContext] React props not found. Using fallback."
      );
      inputElement.value = valueToSet;
      inputElement.dispatchEvent(
        new Event("input", { bubbles: true, cancelable: true })
      );
      if (isStyleReductionCMDK && valueToSet.trim() !== "") {
        inputElement.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            bubbles: true,
            cancelable: true,
          })
        );
      }
      return;
    }

    const reactProps = inputElement[reactPropsKey];
    const callReactOnChange = (val, simulateEnter = false) => {
      const mockEvent = {
        currentTarget: { value: val },
        target: inputElement,
        isTrusted: false,
        bubbles: true,
        nativeEvent: { isTrusted: false },
      };
      inputElement.value = val;
      reactProps.onChange(mockEvent);
      if (simulateEnter) {
        inputElement.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            composed: true,
          })
        );
      }
    };

    inputElement.focus();
    await new Promise((r) => setTimeout(r, 50));

    if (isStyleReductionCMDK) {
      const clearButton = inputElement
        .closest(".relative.w-full.space-y-2")
        ?.querySelector(
          'button[title="Clear Style Reduction"]:not([disabled])'
        );
      if (clearButton) {
        clearButton.click();
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    callReactOnChange("", false);
    await new Promise((r) => setTimeout(r, 50));

    if (valueToSet.trim() !== "") {
      callReactOnChange(valueToSet, isStyleReductionCMDK);
    }

    await new Promise((r) => setTimeout(r, 100));
    inputElement.blur();
  };

  /**
   * Listen for the custom event dispatched from the content script.
   */
  document.addEventListener("upm:applyPreset", (e) => {
    const { tempId, valueToSet, managerId } = e.detail;
    const targetElement = document.getElementById(tempId);
    if (targetElement) {
      applyReactPresetInPageContext(targetElement, valueToSet, managerId);
      // The content script will also try to remove this, but we do it here
      // as soon as we're done with it for robustness.
      targetElement.removeAttribute("id");
    }
  });
})();
