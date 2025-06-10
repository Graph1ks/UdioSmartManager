import { Logger } from "@/modules/logger.js";
import { PresetManager } from "@/modules/ui/presetManager.js";
import { LyricVaultManager } from "@/modules/ui/lyricVaultManager.js"; // Import new manager
import { UdioIntegration } from "@/modules/ui/integration.js";
import { loadData } from "@/modules/dataLoader.js";
import { MANAGER_CONFIGS } from "@/modules/config.js";

const logger = new Logger("Main");

/**
 * Injects a script that runs in the page's main world context.
 * This is necessary to interact with the page's JavaScript, like React's event handlers.
 */
function injectPageScript() {
  try {
    const script = document.createElement("script");
    // Load the script from the extension's resources, which is now at the root.
    script.src = chrome.runtime.getURL("page_context_script.js");
    (document.head || document.documentElement).appendChild(script);
    // The script is loaded and executed, we can remove the tag from the DOM.
    script.onload = () => {
      script.remove();
    };
    logger.log("Page-level interaction script injected.");
  } catch (e) {
    logger.error("Failed to inject page script:", e);
  }
}

/**
 * Injects a stylesheet into the document's head.
 * @param {string} url - The URL of the stylesheet.
 */
function injectStylesheet(url) {
  try {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = url;
    (document.head || document.documentElement).appendChild(link);
    logger.log(`Injected stylesheet: ${url}`);
  } catch (e) {
    logger.error(`Failed to inject stylesheet: ${url}`, e);
  }
}

/**
 * Main function to initialize the Udio Smart Manager extension.
 */
async function main() {
  logger.log("Udio Smart Manager initializing...");

  // 0. Inject the page-level script for React interaction
  injectPageScript();

  // 1. Inject necessary stylesheets from the extension package.
  injectStylesheet(chrome.runtime.getURL("css/main.css"));
  injectStylesheet(
    "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
  );

  // 2. Load external data for the prompt generator from local files.
  let promptGenData, isDataLoaded;
  try {
    const data = await loadData();
    promptGenData = data.promptGenData;
    isDataLoaded = data.isDataLoaded;
    if (!isDataLoaded) {
      logger.error(
        "Data load function completed but did not return loaded data. Some features may be unavailable."
      );
    }
  } catch (e) {
    logger.error(
      "Critical data load failure. Prompt Generator will be disabled.",
      e
    );
    promptGenData = {};
    isDataLoaded = false;
  }

  // 3. Initialize ALL Managers
  let promptManager, styleReductionManager, lyricVaultManager;

  try {
    promptManager = new PresetManager(MANAGER_CONFIGS.prompt);
    await promptManager.loadPresets();
  } catch (e) {
    logger.error(
      "FATAL: Failed to initialize Prompt Preset Manager. This feature will be disabled.",
      e
    );
  }

  try {
    styleReductionManager = new PresetManager(MANAGER_CONFIGS.styleReduction);
    await styleReductionManager.loadPresets();
  } catch (e) {
    logger.error(
      "FATAL: Failed to initialize Style Reduction Preset Manager. This feature will be disabled.",
      e
    );
  }

  try {
    lyricVaultManager = new LyricVaultManager();
    await lyricVaultManager.loadItems(); // Corrected method name from loadLyrics to loadItems
  } catch (e) {
    logger.error(
      "FATAL: Failed to initialize LyricVault Manager. This feature will be disabled.",
      e
    );
  }

  // 4. Initialize the main UI integration logic.
  if (promptManager && styleReductionManager && lyricVaultManager) {
    try {
      await UdioIntegration.init(
        promptManager,
        styleReductionManager,
        lyricVaultManager, // Pass the new manager
        promptGenData,
        isDataLoaded
      );
      setTimeout(() => UdioIntegration.checkForUIDisplay(), 1000);
    } catch (e) {
      logger.error(
        "CRITICAL: Failed to initialize the main UI Integration module. The extension will not be visible.",
        e
      );
    }
  } else {
    logger.error(
      "CRITICAL: Could not create one or more managers. The extension cannot start properly."
    );
  }

  // 5. Add a final sanity check for the UI.
  setTimeout(() => {
    if (UdioIntegration.isIntegratedUISetup === false) {
      logger.log("Running a delayed final check for UI presence.");
      UdioIntegration.checkForUIDisplay();
    }
  }, 2500);

  logger.log("Udio Smart Manager initialization sequence complete.");
}

// Ensure the DOM is ready, then run the main function.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
