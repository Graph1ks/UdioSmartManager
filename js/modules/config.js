// js/modules/config.js

import { applyReactControlledInputPreset } from "./utils.js";

// --- CORE SETTINGS ---
export const DEBUG_MODE = true; // Set to false for production to disable detailed logs
export const UPM_UI_PREFIX = "upm";
export const USPM_UI_PREFIX = "uspm";
export const DATA_SOURCE_URL =
  "https://lyricism.neocities.org/data/udio_prompt_data.json";

// --- PROMPT GENERATOR CONSTANTS ---
export const STRONG_AFFINITY_NATION_PROBABILITY = 0.9;
export const MAJOR_NATION_PROBABILITY = 0.85;

// --- MANAGER CONFIGURATIONS ---
// Defines settings for each type of preset manager (prompt, style-reduction)
export const MANAGER_CONFIGS = {
  prompt: {
    id: "prompt",
    uiTitle: "Udio Prompt Presets",
    storageKey: "udioPromptPresets_v2",
    uiPositionStorageKey: `udioPrompt_${USPM_UI_PREFIX}_uiPos_v1`,
    uiSizeStorageKey: `udioPrompt_${USPM_UI_PREFIX}_uiSize_v1`,
    exportFileName: "udio_prompts.json",
    defaultPresetsUrl: "content/prompts.json",
    targetInputSelector: () => {
      const r = document.querySelector('button[title="Randomize prompt"]');
      if (
        r &&
        r.nextElementSibling &&
        r.nextElementSibling.tagName === "TEXTAREA"
      )
        return r.nextElementSibling;
      if (r && r.parentElement) {
        const t = r.parentElement.querySelectorAll("textarea");
        if (t.length === 1) return t[0];
        for (let a of t)
          if (
            a.placeholder &&
            a.placeholder.toLowerCase().includes("a song about")
          )
            return a;
      }
      const p = document.querySelector(
        'textarea[placeholder^="The autobiography of a dollar bill"], textarea[placeholder*="song about"], textarea[placeholder*="Describe Your Song"]'
      );
      if (p) return p;
      return null;
    },
    itemsPerPageIntegrated: 20,
  },
  styleReduction: {
    id: "style-reduction",
    uiTitle: "Udio Style Reduction Presets",
    storageKey: "udioStyleReductionPresets_v4",
    uiPositionStorageKey: `udioStyleReduction_${USPM_UI_PREFIX}_uiPos_v1`,
    uiSizeStorageKey: `udioStyleReduction_${USPM_UI_PREFIX}_uiSize_v1`,
    exportFileName: "udio_stylereduction.json",
    defaultPresetsUrl: "content/stylereduction.json",
    targetInputSelector: () => {
      // Find the input element globally.
      const srInput = document.querySelector(
        'input[cmdk-input][placeholder*="avoid"]'
      );

      // If the input doesn't even exist in the DOM, we're done.
      if (!srInput) {
        return null;
      }

      // Check if it's visible and its controlling region is open.
      const isVisible = srInput.offsetParent !== null;
      const region = srInput.closest('div[role="region"][id^="radix-"]');
      const isRegionOpen =
        region && region.getAttribute("data-state") === "open";

      if (isVisible && isRegionOpen) {
        return srInput;
      }

      // If any condition fails, it's not usable.
      return null;
    },
    itemsPerPageIntegrated: 20,
  },
  lyricVault: {
    id: "lyricVault",
    uiTitle: "Udio LyricVault",
    storageKey: "udioLyrics_v2",
    lastAppliedStorageKey: "udioLyricVaultLastApplied_v1",
    uiPositionStorageKey: `udioLyricVault_${USPM_UI_PREFIX}_uiPos_v1`, // New
    uiSizeStorageKey: `udioLyricVault_${USPM_UI_PREFIX}_uiSize_v1`, // New
    exportFileName: "udio_lyrics.json",
    targetInputSelector: () => {
      // Find the TipTap editor for custom lyrics, but only when it's active.
      const customLyricsRadio = document.querySelector(
        'button[role="radio"][value="user"][data-state="checked"]'
      );
      if (!customLyricsRadio) return null; // Not in custom mode

      return document.querySelector(
        '.tiptap.ProseMirror[contenteditable="true"]'
      );
    },
  },
};

// --- ICONS ---
export const ICONS = {
  settings: "settings",
  add: "add_circle",
  delete: "delete_sweep",
  close: "close",
  upload: "file_upload",
  download: "file_download",
  confirm: "check_circle",
  cancel: "cancel",
  drag_handle: "drag_indicator",
  edit: "edit",
  save: "save",
  apply: "input",
  expand_more: "expand_more",
  expand_less: "expand_less",
  manage: "tune",
  sort_alpha: "sort_by_alpha",
  prev: "arrow_back_ios",
  next: "arrow_forward_ios",
  generate: "auto_awesome",
  copy: "content_copy",
  delete_forever: "delete_forever",
  library_add: "library_add",
  chevron_right: "chevron_right",
  search: "search",
  lyrics: "music_note",
  folder: "folder",
  folder_open: "folder_open",
  add_folder: "create_new_folder",
  apply_selection: "rule",
};
