import { Logger } from "@/modules/logger.js";
import { UPM_UI_PREFIX, ICONS, MANAGER_CONFIGS } from "@/modules/config.js";
import {
  createIcon,
  applyReactControlledInputPreset,
} from "@/modules/utils.js";
import {
  getRandomElement,
  generateUdioStructuredPrompt,
} from "@/modules/promptEngine.js";

const logger = new Logger("PromptGeneratorUI");

export const UdioPromptGeneratorIntegrated = {
  promptGenData: null,
  isDataLoaded: false,
  ui: {
    accordionHeader: null,
    accordionContent: null,
    promptModeSelect: null,
    genreCategorySelect: null,
    generateBtn: null,
    generatedPromptTextarea: null,
    copyBtn: null,
    applyBtn: null,
    lookupResultsContainer: null,
  },
  isAccordionOpen: false,

  async init(promptGenData, isDataLoaded) {
    this.promptGenData = promptGenData;
    this.isDataLoaded = isDataLoaded;
    const storedState = await chrome.storage.local.get(
      "upmAdvGenAccordionOpen_v1"
    );
    this.isAccordionOpen = storedState.upmAdvGenAccordionOpen_v1 || false;
  },

  populateGenreCategoryFilterForEmbeddedUI(selectElement) {
    if (!selectElement) return;
    selectElement.innerHTML =
      '<option value="all">All Genre Categories</option>';
    const categoryKeys = Object.keys(this.promptGenData.metaGenreCategories)
      .filter(
        (key) =>
          key !== "all" &&
          this.promptGenData.metaGenreCategories[key] &&
          Array.isArray(this.promptGenData.metaGenreCategories[key])
      )
      .sort();
    categoryKeys.forEach((categoryKey) => {
      if (this.promptGenData.metaGenreCategories[categoryKey].length === 0)
        return;
      const option = document.createElement("option");
      option.value = categoryKey;
      let displayName = categoryKey
        .replace(/([A-Z]+)/g, " $1")
        .replace(/([A-Z][a-z])/g, " $1")
        .trim();
      displayName = displayName
        .replace(/\bRnB\b/g, "R&B")
        .replace(/World Latin Reggae/g, "World/Latin/Reggae")
        .replace(/Blues Country/g, "Blues/Country")
        .replace(/Hip Hop/g, "Hip Hop")
        .replace(/Classical Music/g, "Classical");
      option.textContent =
        displayName.charAt(0).toUpperCase() + displayName.slice(1);
      selectElement.appendChild(option);
    });
  },

  createUI() {
    const generatorContainer = document.createElement("div");
    generatorContainer.id = `${UPM_UI_PREFIX}-integrated-advanced-generator`;
    generatorContainer.className = `${UPM_UI_PREFIX}-integrated-advanced-generator`;

    this.ui.accordionHeader = document.createElement("div");
    this.ui.accordionHeader.className = `${UPM_UI_PREFIX}-advanced-generator-accordion-header`;
    this.ui.accordionHeader.textContent = "Advanced Prompt Generator ";
    const expandIcon = createIcon(
      this.isAccordionOpen ? ICONS.expand_less : ICONS.expand_more,
      `${UPM_UI_PREFIX}-accordion-icon`
    );
    this.ui.accordionHeader.appendChild(expandIcon);
    this.ui.accordionHeader.onclick = () => this.toggleAccordion();
    generatorContainer.appendChild(this.ui.accordionHeader);

    this.ui.accordionContent = document.createElement("div");
    this.ui.accordionContent.className = `${UPM_UI_PREFIX}-advanced-generator-accordion-content`;
    this.ui.accordionContent.style.display = this.isAccordionOpen
      ? "block"
      : "none";

    const controlsDiv = document.createElement("div");
    controlsDiv.className = `${UPM_UI_PREFIX}-advanced-generator-controls ${UPM_UI_PREFIX}-integrated-controls`;

    this.ui.promptModeSelect = document.createElement("select");
    this.ui.promptModeSelect.id = `${UPM_UI_PREFIX}IntegratedAdvancedPromptMode`;
    this.ui.promptModeSelect.className = `${UPM_UI_PREFIX}-advanced-generator-select ${UPM_UI_PREFIX}-integrated-select`;
    const modes = [
      { value: "coherent", text: "Coherent Random" },
      { value: "coherent_instrumental", text: "Coherent Instrumental" },
      { value: "hardcore", text: "Hardcore Random" },
      { value: "hardcore_instrumental", text: "Instrumental Random" },
    ];
    modes.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.value;
      opt.textContent = m.text;
      this.ui.promptModeSelect.appendChild(opt);
    });
    controlsDiv.appendChild(this.ui.promptModeSelect);

    this.ui.genreCategorySelect = document.createElement("select");
    this.ui.genreCategorySelect.id = `${UPM_UI_PREFIX}IntegratedGenreCategoryFilter`;
    this.ui.genreCategorySelect.className = `${UPM_UI_PREFIX}-advanced-generator-select ${UPM_UI_PREFIX}-integrated-select`;
    this.populateGenreCategoryFilterForEmbeddedUI(this.ui.genreCategorySelect);
    controlsDiv.appendChild(this.ui.genreCategorySelect);

    this.ui.generateBtn = document.createElement("button");
    this.ui.generateBtn.id = `${UPM_UI_PREFIX}IntegratedAdvancedGenerateBtn`;
    this.ui.generateBtn.className = `${UPM_UI_PREFIX}-btn ${UPM_UI_PREFIX}-btn-generate`;
    this.ui.generateBtn.appendChild(createIcon(ICONS.generate));
    this.ui.generateBtn.appendChild(document.createTextNode(" Generate"));
    this.ui.generateBtn.onclick = () => this.handleGeneratePrompt();
    controlsDiv.appendChild(this.ui.generateBtn);
    this.ui.accordionContent.appendChild(controlsDiv);

    const modeDescription = document.createElement("p");
    modeDescription.className = `${UPM_UI_PREFIX}-advanced-generator-mode-desc ${UPM_UI_PREFIX}-integrated-mode-desc`;
    modeDescription.textContent =
      "Coherent: Uses category filter. Hardcore: Full random.";
    this.ui.accordionContent.appendChild(modeDescription);

    const promptDisplayArea = document.createElement("div");
    promptDisplayArea.className = `${UPM_UI_PREFIX}-advanced-generator-prompt-area ${UPM_UI_PREFIX}-integrated-prompt-area`;
    this.ui.generatedPromptTextarea = document.createElement("textarea");
    this.ui.generatedPromptTextarea.id = `${UPM_UI_PREFIX}IntegratedAdvancedGeneratedPrompt`;
    this.ui.generatedPromptTextarea.className = `${UPM_UI_PREFIX}-advanced-generator-textarea ${UPM_UI_PREFIX}-integrated-textarea`;
    this.ui.generatedPromptTextarea.readOnly = true;
    this.ui.generatedPromptTextarea.rows = 3;
    this.ui.generatedPromptTextarea.placeholder = "Generated prompt...";
    promptDisplayArea.appendChild(this.ui.generatedPromptTextarea);

    const promptActionsDiv = document.createElement("div");
    promptActionsDiv.className = `${UPM_UI_PREFIX}-advanced-generator-prompt-actions ${UPM_UI_PREFIX}-integrated-prompt-actions`;
    this.ui.copyBtn = document.createElement("button");
    this.ui.copyBtn.className = `${UPM_UI_PREFIX}-btn ${UPM_UI_PREFIX}-btn-secondary ${UPM_UI_PREFIX}-integrated-action-btn`;
    this.ui.copyBtn.appendChild(createIcon(ICONS.copy));
    this.ui.copyBtn.appendChild(document.createTextNode(" Copy"));
    this.ui.copyBtn.onclick = () => this.handleCopyPrompt();
    promptActionsDiv.appendChild(this.ui.copyBtn);

    this.ui.applyBtn = document.createElement("button");
    this.ui.applyBtn.className = `${UPM_UI_PREFIX}-btn ${UPM_UI_PREFIX}-btn-apply ${UPM_UI_PREFIX}-integrated-action-btn`;
    this.ui.applyBtn.appendChild(createIcon(ICONS.apply));
    this.ui.applyBtn.appendChild(
      document.createTextNode(" Apply Prompt") // FIXED
    );
    this.ui.applyBtn.onclick = () => this.handleApplyPrompt();
    promptActionsDiv.appendChild(this.ui.applyBtn);
    promptDisplayArea.appendChild(promptActionsDiv);
    this.ui.accordionContent.appendChild(promptDisplayArea);

    const lookupControlsDiv = document.createElement("div");
    lookupControlsDiv.className = `${UPM_UI_PREFIX}-advanced-generator-lookup-controls ${UPM_UI_PREFIX}-integrated-lookup-controls`;
    const lookupItems = [
      { id: "showGenresBtnAdvInt", text: "Genres", dataKey: "genres" },
      {
        id: "showInstrumentsBtnAdvInt",
        text: "Instruments",
        dataKey: "instruments",
      },
      { id: "showEmotionsBtnAdvInt", text: "Emotions", dataKey: "emotions" },
      {
        id: "showProductionBtnAdvInt",
        text: "Production",
        dataKey: "productions",
      },
      { id: "showVocalsBtnAdvInt", text: "Vocals", dataKey: "vocals" },
      { id: "showPeriodsBtnAdvInt", text: "Periods", dataKey: "periods" },
    ];
    lookupItems.forEach((item) => {
      const btn = document.createElement("button");
      btn.id = item.id;
      btn.className = `${UPM_UI_PREFIX}-lookup-btn ${UPM_UI_PREFIX}-integrated-lookup-btn`;
      btn.textContent = item.text;
      btn.onclick = () =>
        this.displayQuickLookup(this.promptGenData[item.dataKey], item.text);
      lookupControlsDiv.appendChild(btn);
    });
    this.ui.accordionContent.appendChild(lookupControlsDiv);

    this.ui.lookupResultsContainer = document.createElement("div");
    this.ui.lookupResultsContainer.id = `${UPM_UI_PREFIX}IntegratedAdvancedLookupResults`;
    this.ui.lookupResultsContainer.className = `${UPM_UI_PREFIX}-advanced-generator-lookup-results ${UPM_UI_PREFIX}-integrated-lookup-results`;
    this.ui.accordionContent.appendChild(this.ui.lookupResultsContainer);

    generatorContainer.appendChild(this.ui.accordionContent);
    return generatorContainer;
  },

  toggleAccordion() {
    this.isAccordionOpen = !this.isAccordionOpen;
    chrome.storage.local.set({
      upmAdvGenAccordionOpen_v1: this.isAccordionOpen,
    });
    if (this.ui.accordionContent && this.ui.accordionHeader) {
      this.ui.accordionContent.style.display = this.isAccordionOpen
        ? "block"
        : "none";
      const icon = this.ui.accordionHeader.querySelector(
        `.${UPM_UI_PREFIX}-accordion-icon`
      );
      if (icon) {
        icon.textContent = this.isAccordionOpen
          ? ICONS.expand_less
          : ICONS.expand_more;
      }
    }
  },

  handleGeneratePrompt() {
    if (
      !this.ui.promptModeSelect ||
      !this.ui.genreCategorySelect ||
      !this.ui.generatedPromptTextarea ||
      !this.ui.generateBtn
    )
      return;
    if (!this.isDataLoaded) {
      alert("Prompt generation data is not loaded yet.");
      return;
    }

    this.ui.generateBtn.classList.add(`${UPM_UI_PREFIX}-glowing`);
    setTimeout(() => {
      this.ui.generateBtn.classList.remove(`${UPM_UI_PREFIX}-glowing`);
    }, 500);

    const mode = this.ui.promptModeSelect.value;
    const selectedCategory = this.ui.genreCategorySelect.value;
    const newPrompt = generateUdioStructuredPrompt(
      mode,
      selectedCategory,
      this.promptGenData
    );
    this.ui.generatedPromptTextarea.value = newPrompt;
    this.ui.generatedPromptTextarea.scrollTop = 0;
  },

  handleCopyPrompt() {
    if (!this.ui.generatedPromptTextarea || !this.ui.copyBtn) return;
    const textToCopy = this.ui.generatedPromptTextarea.value;
    if (!textToCopy) return;

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        const originalText = this.ui.copyBtn.innerHTML;
        this.ui.copyBtn.innerHTML = `${
          createIcon(ICONS.confirm).outerHTML
        } Copied!`;
        this.ui.copyBtn.classList.add(`${UPM_UI_PREFIX}-copied-transient`);
        setTimeout(() => {
          this.ui.copyBtn.innerHTML = originalText;
          this.ui.copyBtn.classList.remove(`${UPM_UI_PREFIX}-copied-transient`);
        }, 1500);
      })
      .catch((err) => {
        logger.error("Failed to copy prompt:", err);
        const originalText = this.ui.copyBtn.innerHTML;
        this.ui.copyBtn.textContent = "Error";
        setTimeout(() => {
          this.ui.copyBtn.innerHTML = originalText;
        }, 1500);
      });
  },

  handleApplyPrompt() {
    // FIXED: No longer async, doesn't need to be.
    if (!this.ui.generatedPromptTextarea) return;
    const promptToApply = this.ui.generatedPromptTextarea.value;
    if (!promptToApply) return;

    const targetTextarea =
      typeof MANAGER_CONFIGS.prompt.targetInputSelector === "function"
        ? MANAGER_CONFIGS.prompt.targetInputSelector()
        : document.querySelector(MANAGER_CONFIGS.prompt.targetInputSelector);

    if (targetTextarea) {
      // FIXED: No longer awaiting or checking a return value. Assume success.
      applyReactControlledInputPreset(
        targetTextarea,
        promptToApply,
        `${UPM_UI_PREFIX}-AdvGen-Integrated`,
        logger
      );

      // Immediately show success feedback.
      this.ui.applyBtn.classList.add(`${UPM_UI_PREFIX}-applied-transient`);
      const originalText = this.ui.applyBtn.innerHTML;
      this.ui.applyBtn.innerHTML = `${
        createIcon(ICONS.confirm).outerHTML
      } Applied!`;
      setTimeout(() => {
        this.ui.applyBtn.innerHTML = originalText;
        this.ui.applyBtn.classList.remove(`${UPM_UI_PREFIX}-applied-transient`);
      }, 1500);
    } else {
      alert(
        `[${UPM_UI_PREFIX} Gen] Could not find the main Udio prompt textarea.`
      );
    }
  },

  displayQuickLookup(dataList, categoryName) {
    if (!this.ui.lookupResultsContainer) return;
    this.ui.lookupResultsContainer.innerHTML = "";

    if (!this.isDataLoaded) {
      this.ui.lookupResultsContainer.textContent = "Data not loaded.";
      return;
    }

    if (!dataList || dataList.length === 0) {
      this.ui.lookupResultsContainer.textContent = `No items in ${categoryName}.`;
    } else {
      const title = document.createElement("h4");
      title.textContent = `Random ${categoryName} (Max 3):`;
      title.className = `${UPM_UI_PREFIX}-lookup-results-title`;
      this.ui.lookupResultsContainer.appendChild(title);

      const itemsToShow = getRandomElement(dataList, 3);
      itemsToShow.forEach((item) => {
        const itemBox = document.createElement("div");
        itemBox.className = `${UPM_UI_PREFIX}-lookup-item-box`;

        const itemParagraph = document.createElement("p");
        itemParagraph.textContent = item;

        const copyBtn = document.createElement("button");
        copyBtn.className = `${UPM_UI_PREFIX}-btn ${UPM_UI_PREFIX}-btn-icon-only ${UPM_UI_PREFIX}-lookup-copy-btn`;
        copyBtn.title = "Copy term";
        copyBtn.appendChild(createIcon(ICONS.copy));
        copyBtn.onclick = (e) => {
          e.stopPropagation();
          this.copyIndividualTerm(item, copyBtn);
        };

        itemBox.appendChild(itemParagraph);
        itemBox.appendChild(copyBtn);
        this.ui.lookupResultsContainer.appendChild(itemBox);
      });
    }
  },

  copyIndividualTerm(textToCopy, buttonElement) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalIcon = buttonElement.innerHTML;
      buttonElement.innerHTML = createIcon(ICONS.confirm).outerHTML;
      buttonElement.classList.add(`${UPM_UI_PREFIX}-copied-transient`);
      setTimeout(() => {
        buttonElement.innerHTML = originalIcon;
        buttonElement.classList.remove(`${UPM_UI_PREFIX}-copied-transient`);
      }, 1200);
    });
  },
};
