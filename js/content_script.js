// js/content_script.js

import { Logger } from "@/modules/logger.js";
import { PresetManager } from "@/modules/ui/presetManager.js";
import { LyricVaultManager } from "@/modules/ui/lyricVaultManager.js";
import { UdioIntegration } from "@/modules/ui/integration.js";
import { Launcher } from "@/modules/ui/launcher.js";
import { UdioPromptGeneratorIntegrated } from "@/modules/ui/promptGeneratorUI.js";
import { loadData } from "@/modules/dataLoader.js";
import { MANAGER_CONFIGS } from "@/modules/config.js";

const logger = new Logger("Main");

function injectPageScript() {
  if (!window.location.hostname.includes("udio.com")) return;
  try {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("page_context_script.js");
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => {
      script.remove();
    };
    logger.log("Page-level interaction script injected.");
  } catch (e) {
    logger.error("Failed to inject page script:", e);
  }
}

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

async function main() {
  logger.log("Udio Smart Manager initializing...");

  injectPageScript();
  injectStylesheet(chrome.runtime.getURL("css/main.css"));
  // **REMOVED**: The external font stylesheet is no longer needed.

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

  await UdioPromptGeneratorIntegrated.init(promptGenData, isDataLoaded);

  let promptManager, styleReductionManager, lyricVaultManager, launcher;

  try {
    promptManager = new PresetManager(MANAGER_CONFIGS.prompt);
    await promptManager.loadPresets();
  } catch (e) {
    logger.error("FATAL: Failed to initialize Prompt Preset Manager.", e);
  }

  try {
    styleReductionManager = new PresetManager(MANAGER_CONFIGS.styleReduction);
    await styleReductionManager.loadPresets();
  } catch (e) {
    logger.error(
      "FATAL: Failed to initialize Style Reduction Preset Manager.",
      e
    );
  }

  try {
    lyricVaultManager = new LyricVaultManager();
    await lyricVaultManager.loadItems();
  } catch (e) {
    logger.error("FATAL: Failed to initialize LyricVault Manager.", e);
  }

  if (promptManager && styleReductionManager && lyricVaultManager) {
    launcher = new Launcher(
      promptManager,
      styleReductionManager,
      lyricVaultManager
    );

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "toggleLauncherWindow") {
        launcher.toggleLauncherWindow();
      }
    });

    if (window.location.hostname.includes("udio.com")) {
      try {
        await UdioIntegration.init(
          promptManager,
          styleReductionManager,
          lyricVaultManager,
          promptGenData,
          isDataLoaded
        );
      } catch (e) {
        logger.error(
          "CRITICAL: Failed to initialize the main UI Integration module.",
          e
        );
      }
    } else {
      logger.log(
        "Not on udio.com. Skipping Udio-specific UI integration. Global launcher is ready."
      );
    }
  } else {
    logger.error(
      "CRITICAL: Could not create one or more managers. The extension cannot start properly."
    );
  }

  logger.log("Udio Smart Manager initialization sequence complete.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
