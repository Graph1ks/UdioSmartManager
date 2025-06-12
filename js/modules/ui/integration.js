// js/modules/ui/integration.js

import { Logger } from "@/modules/logger.js";
import { UPM_UI_PREFIX, ICONS, MANAGER_CONFIGS } from "@/modules/config.js";
import {
  createIcon,
  debounce,
  applyReactControlledInputPreset,
} from "@/modules/utils.js";
import { UdioPromptGeneratorIntegrated } from "./promptGeneratorUI.js";

const logger = new Logger("UdioIntegration");

export const UdioIntegration = {
  promptManager: null,
  styleReductionManager: null,
  lyricVaultManager: null,
  isDataLoaded: false,
  promptGenData: null,
  isIntegratedUISetup: false,
  observerInstance: null,
  _searchDebouncers: {},
  lyricsEditorListenerAttached: false,

  ui: {
    mainCollapsibleSection: null,
    collapsibleHeader: null,
    collapsibleContent: null,
    promptPresetListContainer: null,
    styleReductionPresetListContainer: null,
    styleReductionSubSection: null,
    styleReductionManageButton: null,
    advancedPromptGeneratorUI: null,
    lyricVaultTrigger: null,
    isAccordionOpen: false,
    subsectionStates: { prompt: true, styleReduction: true },
    promptIntegratedCurrentPage: 1,
    styleReductionIntegratedCurrentPage: 1,
    promptSearchTerm: "",
    styleReductionSearchTerm: "",
  },

  observerOptions: { childList: true, subtree: true, attributes: true },
  UI_INJECTION_PARENT_SELECTOR: "div.joyride-create",
  UI_INJECTION_REFERENCE_NODE_SELECTOR:
    "div.mt-2.flex.w-full.flex-row.items-center.justify-between.gap-2",
  LYRIC_BUTTON_CONTAINER_SELECTOR:
    "form.mb-4.flex.grow.items-center.justify-end.gap-3.flex-row",

  debouncedAttemptUIInjection: debounce(function () {
    this.attemptFullUIInjection();
  }, 250),

  async init(
    promptMgr,
    styleReductionMgr,
    lyricVaultMgr,
    promptGenData,
    isDataLoaded
  ) {
    this.promptManager = promptMgr;
    this.styleReductionManager = styleReductionMgr;
    this.lyricVaultManager = lyricVaultMgr;
    this.promptGenData = promptGenData;
    this.isDataLoaded = isDataLoaded;

    await UdioPromptGeneratorIntegrated.init(
      this.promptGenData,
      this.isDataLoaded
    );

    try {
      const storedState = await chrome.storage.local.get([
        "upmAccordionOpenState_v1",
        "upmPromptIntegratedPage_v1",
        "upmStyleReductionIntegratedPage_v1",
        "upmSubsectionStates_v1",
      ]);
      this.ui.isAccordionOpen = storedState.upmAccordionOpenState_v1 ?? false;
      if (storedState.upmSubsectionStates_v1)
        this.ui.subsectionStates = storedState.upmSubsectionStates_v1;
      this.ui.promptIntegratedCurrentPage =
        parseInt(storedState.upmPromptIntegratedPage_v1, 10) || 1;
      this.ui.styleReductionIntegratedCurrentPage =
        parseInt(storedState.upmStyleReductionIntegratedPage_v1, 10) || 1;
    } catch (e) {
      logger.error("Failed to load UI state from storage:", e);
    }

    this.observerInstance = new MutationObserver(
      this.handleMutations.bind(this)
    );
    this.connectObserver();

    this.attemptFullUIInjection();
    logger.log("UdioIntegration initialized. Observing for UI changes.");
  },

  handleMutations() {
    this.debouncedAttemptUIInjection();
  },

  disconnectObserver() {
    if (this.observerInstance) this.observerInstance.disconnect();
  },
  connectObserver() {
    if (this.observerInstance)
      this.observerInstance.observe(document.body, this.observerOptions);
  },

  attemptFullUIInjection() {
    const injectionParent = document.querySelector(
      this.UI_INJECTION_PARENT_SELECTOR
    );

    if (injectionParent && !this.isIntegratedUISetup) {
      const referenceNode = injectionParent.querySelector(
        this.UI_INJECTION_REFERENCE_NODE_SELECTOR
      );
      if (referenceNode) {
        logger.log("Create page UI detected. Injecting Smart Manager.");
        this.injectMainCollapsibleSection(injectionParent, referenceNode);
      }
    } else if (!injectionParent && this.isIntegratedUISetup) {
      logger.log("Create page UI has been removed. Resetting state.");
      if (this.ui.mainCollapsibleSection) {
        this.ui.mainCollapsibleSection.remove();
        this.ui.mainCollapsibleSection = null;
      }
      this.isIntegratedUISetup = false;
    }

    this.injectLyricVaultTriggerButton();
    this.setupLyricsEditorListener();

    // **FIXED**: Instead of a full refresh, we only do a lightweight state update
    // for the Style Reduction panel. This is the only part of our UI that needs
    // to react to external DOM changes, and this change will not cause a flicker-loop.
    if (this.isIntegratedUISetup) {
      const srInputIsVisible =
        !!MANAGER_CONFIGS.styleReduction.targetInputSelector();

      if (this.ui.styleReductionSubSection) {
        const header = this.ui.styleReductionSubSection.querySelector(
          `.${UPM_UI_PREFIX}-subsection-header > span`
        );
        if (header) {
          header.textContent = srInputIsVisible
            ? "Style Reduction Presets"
            : "Style Reduction Presets (Open Advanced Controls to use)";
        }

        // The .upm-subsection-disabled CSS class handles pointer-events and opacity.
        this.ui.styleReductionSubSection.classList.toggle(
          `${UPM_UI_PREFIX}-subsection-disabled`,
          !srInputIsVisible
        );
      }
    }
  },

  setupLyricsEditorListener() {
    const lyricsEditor = MANAGER_CONFIGS.lyricVault.targetInputSelector();
    if (lyricsEditor && !this.lyricsEditorListenerAttached) {
      lyricsEditor.addEventListener("dblclick", (e) => {
        if (e.ctrlKey || e.metaKey) {
          logger.log("Lyrics editor CTRL+Double-Clicked.");
          this.lyricVaultManager.toggleManagerAndSelectLast();
        }
      });
      this.lyricsEditorListenerAttached = true;
      logger.log("CTRL+Double-Click listener attached to lyrics editor.");
    } else if (!lyricsEditor) {
      this.lyricsEditorListenerAttached = false;
    }
  },

  injectLyricVaultTriggerButton() {
    const isReady = !!MANAGER_CONFIGS.lyricVault.targetInputSelector();

    if (!isReady) {
      if (this.ui.lyricVaultTrigger) {
        this.ui.lyricVaultTrigger.remove();
        this.ui.lyricVaultTrigger = null;
      }
      return;
    }

    const buttonContainer = document.querySelector(
      this.LYRIC_BUTTON_CONTAINER_SELECTOR
    );
    if (!buttonContainer) return;

    const existingButton = buttonContainer.querySelector(
      `#${UPM_UI_PREFIX}-lyric-vault-trigger`
    );
    if (existingButton) return;

    const writeForMeButton = buttonContainer.querySelector(
      'button[title="Generate"]'
    );
    if (!writeForMeButton) return;

    this.ui.lyricVaultTrigger = document.createElement("button");
    this.ui.lyricVaultTrigger.id = `${UPM_UI_PREFIX}-lyric-vault-trigger`;
    this.ui.lyricVaultTrigger.className = writeForMeButton.className;
    this.ui.lyricVaultTrigger.type = "button";
    this.ui.lyricVaultTrigger.innerHTML = `${
      createIcon(ICONS.lyrics).outerHTML
    } LyricVault`;
    this.ui.lyricVaultTrigger.onclick = (e) => {
      e.preventDefault();
      this.lyricVaultManager.toggleManagerWindow();
    };

    writeForMeButton.parentElement.insertAdjacentElement(
      "beforebegin",
      this.ui.lyricVaultTrigger
    );
  },

  async injectMainCollapsibleSection(injectionParent, referenceNode) {
    this.ui.mainCollapsibleSection = document.createElement("div");
    this.ui.mainCollapsibleSection.id = `${UPM_UI_PREFIX}-main-collapsible-section`;
    this.ui.mainCollapsibleSection.className = `${UPM_UI_PREFIX}-main-collapsible-section`;

    this.ui.collapsibleHeader = document.createElement("div");
    this.ui.collapsibleHeader.className = `${UPM_UI_PREFIX}-collapsible-header`;
    this.ui.collapsibleHeader.classList.toggle("open", this.ui.isAccordionOpen);
    const titleDiv = document.createElement("div");
    titleDiv.className = `${UPM_UI_PREFIX}-header-title-integrated`;
    const iconSpan = createIcon(
      ICONS.expand_more,
      `${UPM_UI_PREFIX}-expand-icon`
    );
    iconSpan.style.transform = this.ui.isAccordionOpen
      ? "rotate(180deg)"
      : "rotate(0deg)";
    titleDiv.appendChild(iconSpan);
    titleDiv.appendChild(document.createTextNode(" Prompt & Style Presets"));
    this.ui.collapsibleHeader.appendChild(titleDiv);
    this.ui.collapsibleHeader.onclick = (e) => {
      e.stopPropagation();
      this.toggleAccordion();
    };

    this.ui.collapsibleContent = document.createElement("div");
    this.ui.collapsibleContent.className = `${UPM_UI_PREFIX}-collapsible-content`;
    this.ui.collapsibleContent.style.display = this.ui.isAccordionOpen
      ? "block"
      : "none";

    const promptSection = this.createIntegratedSubSection(
      "prompt",
      "Prompt Presets",
      this.promptManager
    );
    this.ui.promptPresetListContainer = promptSection.querySelector(
      `.${UPM_UI_PREFIX}-integrated-preset-list-area`
    );
    this.ui.collapsibleContent.appendChild(promptSection);

    this.ui.styleReductionSubSection = this.createIntegratedSubSection(
      "styleReduction",
      "Style Reduction Presets",
      this.styleReductionManager
    );
    this.ui.styleReductionPresetListContainer =
      this.ui.styleReductionSubSection.querySelector(
        `.${UPM_UI_PREFIX}-integrated-preset-list-area`
      );
    this.ui.styleReductionManageButton =
      this.ui.styleReductionSubSection.querySelector(
        `.${UPM_UI_PREFIX}-manage-btn`
      );
    this.ui.collapsibleContent.appendChild(this.ui.styleReductionSubSection);

    this.ui.advancedPromptGeneratorUI =
      UdioPromptGeneratorIntegrated.createUI();
    this.ui.collapsibleContent.appendChild(this.ui.advancedPromptGeneratorUI);

    this.ui.mainCollapsibleSection.appendChild(this.ui.collapsibleHeader);
    this.ui.mainCollapsibleSection.appendChild(this.ui.collapsibleContent);

    injectionParent.insertBefore(this.ui.mainCollapsibleSection, referenceNode);
    this.isIntegratedUISetup = true;
    this.refreshIntegratedUI();
  },

  _debouncedSearchHandler(type, searchTerm) {
    if (type === "prompt") {
      if (this.ui.promptSearchTerm !== searchTerm) {
        this.ui.promptIntegratedCurrentPage = 1;
        chrome.storage.local.set({ upmPromptIntegratedPage_v1: 1 });
      }
      this.ui.promptSearchTerm = searchTerm;
    } else if (type === "styleReduction") {
      if (this.ui.styleReductionSearchTerm !== searchTerm) {
        this.ui.styleReductionIntegratedCurrentPage = 1;
        chrome.storage.local.set({ upmStyleReductionIntegratedPage_v1: 1 });
      }
      this.ui.styleReductionSearchTerm = searchTerm;
    }
    this.refreshIntegratedUI();
  },

  createIntegratedSubSection(type, title, managerInstance) {
    const section = document.createElement("div");
    section.className = `${UPM_UI_PREFIX}-subsection`;
    section.dataset.type = type;

    const isOpen = this.ui.subsectionStates[type] ?? true;

    const headerEl = document.createElement("h4");
    headerEl.className = `${UPM_UI_PREFIX}-subsection-header`;
    headerEl.classList.toggle("open", isOpen);
    headerEl.onclick = (e) => {
      e.stopPropagation();
      this.toggleSubAccordion(type);
    };

    const titleSpan = document.createElement("span");
    titleSpan.textContent = title;

    const icon = createIcon(ICONS.expand_more, `${UPM_UI_PREFIX}-expand-icon`);
    icon.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";

    headerEl.appendChild(titleSpan);
    headerEl.appendChild(icon);
    section.appendChild(headerEl);

    const contentWrapper = document.createElement("div");
    contentWrapper.className = `${UPM_UI_PREFIX}-subsection-content`;
    contentWrapper.style.display = isOpen ? "block" : "none";

    const controls = document.createElement("div");
    controls.className = `${UPM_UI_PREFIX}-subsection-controls`;
    const manageBtn = document.createElement("button");
    manageBtn.className = `${UPM_UI_PREFIX}-manage-btn`;
    manageBtn.appendChild(createIcon(ICONS.manage));
    manageBtn.appendChild(document.createTextNode(" Manage Presets"));
    manageBtn.onclick = (e) => {
      e.stopPropagation();
      managerInstance.toggleManagerWindow();
    };
    controls.appendChild(manageBtn);

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = `${UPM_UI_PREFIX}-integrated-search-input`;
    searchInput.placeholder = `Search ${title}...`;
    searchInput.setAttribute("aria-label", `Search ${title}`);
    if (!this._searchDebouncers[type]) {
      this._searchDebouncers[type] = debounce((currentSearchTerm) => {
        this._debouncedSearchHandler(type, currentSearchTerm);
      }, 300);
    }
    searchInput.addEventListener("input", (e) => {
      this._searchDebouncers[type](e.target.value.trim());
    });
    controls.appendChild(searchInput);
    contentWrapper.appendChild(controls);

    const presetArea = document.createElement("div");
    presetArea.className = `${UPM_UI_PREFIX}-integrated-preset-list-area`;
    contentWrapper.appendChild(presetArea);

    section.appendChild(contentWrapper);

    return section;
  },

  toggleAccordion() {
    this.ui.isAccordionOpen = !this.ui.isAccordionOpen;
    chrome.storage.local.set({
      upmAccordionOpenState_v1: this.ui.isAccordionOpen,
    });
    if (this.ui.collapsibleContent && this.ui.collapsibleHeader) {
      this.ui.collapsibleContent.style.display = this.ui.isAccordionOpen
        ? "block"
        : "none";
      const icon = this.ui.collapsibleHeader.querySelector(
        `.${UPM_UI_PREFIX}-expand-icon`
      );
      if (icon)
        icon.style.transform = this.ui.isAccordionOpen
          ? "rotate(180deg)"
          : "rotate(0deg)";
      this.ui.collapsibleHeader.classList.toggle(
        "open",
        this.ui.isAccordionOpen
      );
    }
  },

  toggleSubAccordion(type) {
    const wasOpen = this.ui.subsectionStates[type];
    this.ui.subsectionStates[type] = !wasOpen;

    chrome.storage.local.set({
      upmSubsectionStates_v1: this.ui.subsectionStates,
    });

    const subSection = this.ui.mainCollapsibleSection.querySelector(
      `.upm-subsection[data-type="${type}"]`
    );
    if (!subSection) return;

    const header = subSection.querySelector(
      `.${UPM_UI_PREFIX}-subsection-header`
    );
    const content = subSection.querySelector(
      `.${UPM_UI_PREFIX}-subsection-content`
    );
    const icon = header.querySelector(`.${UPM_UI_PREFIX}-expand-icon`);

    header.classList.toggle("open", !wasOpen);
    content.style.display = !wasOpen ? "block" : "none";
    icon.style.transform = !wasOpen ? "rotate(180deg)" : "rotate(0deg)";
  },

  refreshIntegratedUI() {
    // This function is now only called when the lists *actually* need to be redrawn,
    // for example, after a search or preset modification. It is no longer in the
    // high-frequency MutationObserver loop.
    if (!this.isIntegratedUISetup) {
      return;
    }

    this.renderIntegratedPresetList(
      this.promptManager,
      this.ui.promptPresetListContainer,
      "prompt"
    );
    this.renderIntegratedPresetList(
      this.styleReductionManager,
      this.ui.styleReductionPresetListContainer,
      "styleReduction"
    );

    // It is safe to also update the panel state here for robustness.
    const srInputIsVisible =
      !!MANAGER_CONFIGS.styleReduction.targetInputSelector();
    if (this.ui.styleReductionSubSection) {
      this.ui.styleReductionSubSection.classList.toggle(
        `${UPM_UI_PREFIX}-subsection-disabled`,
        !srInputIsVisible
      );
      const header = this.ui.styleReductionSubSection.querySelector(
        `.${UPM_UI_PREFIX}-subsection-header > span`
      );
      if (header) {
        header.textContent = srInputIsVisible
          ? "Style Reduction Presets"
          : "Style Reduction Presets (Open Advanced Controls to use)";
      }
    }
  },

  renderIntegratedPresetList(manager, areaContainer, type) {
    if (
      !manager ||
      !areaContainer ||
      !areaContainer.isConnected ||
      !MANAGER_CONFIGS[type]
    ) {
      return;
    }

    areaContainer.innerHTML = "";

    const listElement = document.createElement("div");
    listElement.className = `${UPM_UI_PREFIX}-integrated-preset-list`;
    areaContainer.appendChild(listElement);

    const currentSearchTerm =
      (type === "prompt"
        ? this.ui.promptSearchTerm
        : this.ui.styleReductionSearchTerm) || "";
    const presetsToConsider = manager.presets.filter((p) =>
      p.name.toLowerCase().includes(currentSearchTerm.toLowerCase())
    );

    const itemsPerPage = MANAGER_CONFIGS[type].itemsPerPageIntegrated;
    let currentPage =
      type === "prompt"
        ? this.ui.promptIntegratedCurrentPage
        : this.ui.styleReductionIntegratedCurrentPage;
    const totalPages = Math.ceil(presetsToConsider.length / itemsPerPage) || 1;

    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    if (type === "prompt") {
      this.ui.promptIntegratedCurrentPage = currentPage;
    } else {
      this.ui.styleReductionIntegratedCurrentPage = currentPage;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const presetsToDisplay = presetsToConsider.slice(
      startIndex,
      startIndex + itemsPerPage
    );

    if (presetsToDisplay.length === 0) {
      listElement.innerHTML = `<p class="${UPM_UI_PREFIX}-no-presets-integrated">${
        currentSearchTerm ? "No presets match search." : "No presets yet."
      }</p>`;
    } else {
      presetsToDisplay.forEach((preset) => {
        const button = document.createElement("button");
        button.className = `${UPM_UI_PREFIX}-integrated-preset-item`;
        button.title = `Apply: ${preset.name}\nValue: ${preset.value}`;
        const textWrapper = document.createElement("span");
        textWrapper.className = `${UPM_UI_PREFIX}-preset-text-wrapper`;
        textWrapper.textContent = preset.name;
        button.appendChild(textWrapper);
        button.onclick = async (e) => {
          e.stopPropagation();
          button.classList.add(`${UPM_UI_PREFIX}-applying`);
          this.handleApplyPreset(type, preset.value);
          setTimeout(
            () => button.classList.remove(`${UPM_UI_PREFIX}-applying`),
            500
          );
        };
        listElement.appendChild(button);
      });
    }

    let paginationControls = areaContainer.querySelector(
      `.${UPM_UI_PREFIX}-pagination-controls-integrated`
    );
    if (!paginationControls) {
      paginationControls = document.createElement("div");
      paginationControls.className = `${UPM_UI_PREFIX}-pagination-controls-integrated`;
      areaContainer.appendChild(paginationControls);
    } else {
      paginationControls.innerHTML = "";
    }

    if (totalPages > 1) {
      paginationControls.classList.remove(`${UPM_UI_PREFIX}-hidden`);
      const prevBtn = document.createElement("button");
      prevBtn.className = `${UPM_UI_PREFIX}-page-btn-integrated ${UPM_UI_PREFIX}-page-prev-integrated`;
      prevBtn.appendChild(createIcon(ICONS.prev));
      prevBtn.disabled = currentPage <= 1;

      const pageInfoEl = document.createElement("span");
      pageInfoEl.className = `${UPM_UI_PREFIX}-page-info-integrated`;
      pageInfoEl.textContent = `Page ${currentPage} / ${totalPages}`;

      const nextBtn = document.createElement("button");
      nextBtn.className = `${UPM_UI_PREFIX}-page-btn-integrated ${UPM_UI_PREFIX}-page-next-integrated`;
      nextBtn.appendChild(createIcon(ICONS.next));
      nextBtn.disabled = currentPage >= totalPages;

      prevBtn.onclick = (e) => {
        e.stopPropagation();
        if (type === "prompt") {
          if (this.ui.promptIntegratedCurrentPage > 1) {
            this.ui.promptIntegratedCurrentPage--;
            chrome.storage.local.set({
              upmPromptIntegratedPage_v1: this.ui.promptIntegratedCurrentPage,
            });
            this.renderIntegratedPresetList(manager, areaContainer, type);
          }
        } else if (type === "styleReduction") {
          if (this.ui.styleReductionIntegratedCurrentPage > 1) {
            this.ui.styleReductionIntegratedCurrentPage--;
            chrome.storage.local.set({
              upmStyleReductionIntegratedPage_v1:
                this.ui.styleReductionIntegratedCurrentPage,
            });
            this.renderIntegratedPresetList(manager, areaContainer, type);
          }
        }
      };
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        if (type === "prompt") {
          if (this.ui.promptIntegratedCurrentPage < totalPages) {
            this.ui.promptIntegratedCurrentPage++;
            chrome.storage.local.set({
              upmPromptIntegratedPage_v1: this.ui.promptIntegratedCurrentPage,
            });
            this.renderIntegratedPresetList(manager, areaContainer, type);
          }
        } else if (type === "styleReduction") {
          if (this.ui.styleReductionIntegratedCurrentPage < totalPages) {
            this.ui.styleReductionIntegratedCurrentPage++;
            chrome.storage.local.set({
              upmStyleReductionIntegratedPage_v1:
                this.ui.styleReductionIntegratedCurrentPage,
            });
            this.renderIntegratedPresetList(manager, areaContainer, type);
          }
        }
      };

      paginationControls.appendChild(prevBtn);
      paginationControls.appendChild(pageInfoEl);
      paginationControls.appendChild(nextBtn);
    } else {
      paginationControls.classList.add(`${UPM_UI_PREFIX}-hidden`);
    }
  },

  handleApplyPreset(type, presetValue) {
    const config = MANAGER_CONFIGS[type];
    if (!config) {
      logger.error(`Attempted to apply preset for invalid type: ${type}`);
      return;
    }
    const targetInput = config.targetInputSelector();
    if (targetInput) {
      applyReactControlledInputPreset(
        targetInput,
        presetValue,
        `${config.id}-integrated`,
        logger
      );
    } else {
      if (type === "styleReduction") {
        logger.warn(
          "Apply failed: Style Reduction input not found or not visible."
        );
        alert(
          "Style Reduction input not found. Please open 'Advanced Controls' to use this feature."
        );
      } else {
        alert("Target input not found.");
      }
    }
  },
};
