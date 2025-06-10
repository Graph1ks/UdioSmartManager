import { Logger } from "@/modules/logger.js";
import {
  UPM_UI_PREFIX,
  USPM_UI_PREFIX,
  ICONS,
  MANAGER_CONFIGS,
} from "@/modules/config.js";
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
    // For standalone window
    generatorWindow: null,
    resizeHandle: null,
    // For content
    accordionHeader: null,
    accordionContent: null,
    promptModeSelect: null,
    genreCategorySelect: null,
    generateBtn: null,
    generatedPromptTextarea: null,
    primaryActionBtn: null,
    lookupResultsContainer: null,
  },
  isAccordionOpen: true, // Default to open in its own window
  isDragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  isResizing: false,
  resizeStartX: 0,
  resizeStartWidth: 0,
  storageKeys: {
    position: "upm_advGen_pos_v1",
    size: "upm_advGen_size_v1",
  },

  async init(promptGenData, isDataLoaded) {
    this.promptGenData = promptGenData;
    this.isDataLoaded = isDataLoaded;
    const storedState = await chrome.storage.local.get(
      "upmAdvGenAccordionOpen_v1"
    );
    // Only use stored accordion state if it's in the integrated view. Standalone is always open.
    if (
      document.getElementById(`${UPM_UI_PREFIX}-integrated-advanced-generator`)
    ) {
      this.isAccordionOpen = storedState.upmAdvGenAccordionOpen_v1 || false;
    }
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

  // This now returns only the inner content, not the window frame
  createGeneratorContent() {
    const generatorContainer = document.createElement("div");
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
    this.ui.genreCategorySelect.className = `${UPM_UI_PREFIX}-advanced-generator-select ${UPM_UI_PREFIX}-integrated-select`;
    this.populateGenreCategoryFilterForEmbeddedUI(this.ui.genreCategorySelect);
    controlsDiv.appendChild(this.ui.genreCategorySelect);

    this.ui.generateBtn = document.createElement("button");
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
    this.ui.generatedPromptTextarea.className = `${UPM_UI_PREFIX}-advanced-generator-textarea ${UPM_UI_PREFIX}-integrated-textarea`;
    this.ui.generatedPromptTextarea.readOnly = true;
    this.ui.generatedPromptTextarea.rows = 3;
    this.ui.generatedPromptTextarea.placeholder = "Generated prompt...";
    promptDisplayArea.appendChild(this.ui.generatedPromptTextarea);

    const promptActionsDiv = document.createElement("div");
    promptActionsDiv.className = `${UPM_UI_PREFIX}-advanced-generator-prompt-actions ${UPM_UI_PREFIX}-integrated-prompt-actions`;

    const isUdioContext = !!MANAGER_CONFIGS.prompt.targetInputSelector();
    this.ui.primaryActionBtn = document.createElement("button");
    if (isUdioContext) {
      this.ui.primaryActionBtn.className = `${UPM_UI_PREFIX}-btn ${UPM_UI_PREFIX}-btn-apply ${UPM_UI_PREFIX}-integrated-action-btn`;
      this.ui.primaryActionBtn.appendChild(createIcon(ICONS.apply));
      this.ui.primaryActionBtn.appendChild(
        document.createTextNode(" Apply Prompt")
      );
      this.ui.primaryActionBtn.onclick = () => this.handlePrimaryAction(true);
    } else {
      this.ui.primaryActionBtn.className = `${UPM_UI_PREFIX}-btn ${UPM_UI_PREFIX}-btn-secondary ${UPM_UI_PREFIX}-integrated-action-btn`;
      this.ui.primaryActionBtn.appendChild(createIcon(ICONS.copy));
      this.ui.primaryActionBtn.appendChild(
        document.createTextNode(" Copy Prompt")
      );
      this.ui.primaryActionBtn.onclick = () => this.handlePrimaryAction(false);
    }
    promptActionsDiv.appendChild(this.ui.primaryActionBtn);

    promptDisplayArea.appendChild(promptActionsDiv);
    this.ui.accordionContent.appendChild(promptDisplayArea);

    const lookupControlsDiv = document.createElement("div");
    lookupControlsDiv.className = `${UPM_UI_PREFIX}-advanced-generator-lookup-controls ${UPM_UI_PREFIX}-integrated-lookup-controls`;
    const lookupItems = [
      { text: "Genres", dataKey: "genres" },
      { text: "Instruments", dataKey: "instruments" },
      { text: "Emotions", dataKey: "emotions" },
      { text: "Production", dataKey: "productions" },
      { text: "Vocals", dataKey: "vocals" },
      { text: "Periods", dataKey: "periods" },
    ];
    lookupItems.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = `${UPM_UI_PREFIX}-lookup-btn ${UPM_UI_PREFIX}-integrated-lookup-btn`;
      btn.textContent = item.text;
      btn.onclick = () =>
        this.displayQuickLookup(this.promptGenData[item.dataKey], item.text);
      lookupControlsDiv.appendChild(btn);
    });
    this.ui.accordionContent.appendChild(lookupControlsDiv);

    this.ui.lookupResultsContainer = document.createElement("div");
    this.ui.lookupResultsContainer.className = `${UPM_UI_PREFIX}-advanced-generator-lookup-results ${UPM_UI_PREFIX}-integrated-lookup-results`;
    this.ui.accordionContent.appendChild(this.ui.lookupResultsContainer);

    generatorContainer.appendChild(this.ui.accordionContent);
    return generatorContainer;
  },

  // Renamed from createUI for clarity
  createUI() {
    return this.createGeneratorContent();
  },

  // NEW: Creates the entire standalone window
  createGeneratorWindow() {
    if (this.ui.generatorWindow) return;

    this.ui.generatorWindow = document.createElement("div");
    this.ui.generatorWindow.id = "uspm-window-adv-gen";
    this.ui.generatorWindow.className = `${USPM_UI_PREFIX}-window`;
    this.ui.generatorWindow.style.display = "none";
    this.ui.generatorWindow.style.width = "500px";
    this.ui.generatorWindow.style.minWidth = "450px";
    this.ui.generatorWindow.style.height = "auto";
    this.ui.generatorWindow.style.resize = "both";
    this.ui.generatorWindow.style.minHeight = "400px";

    const header = document.createElement("div");
    header.className = `${USPM_UI_PREFIX}-header`;
    header.appendChild(
      createIcon(ICONS.drag_handle, `${USPM_UI_PREFIX}-drag-handle-icon`)
    );
    const titleSpan = document.createElement("span");
    titleSpan.className = `${USPM_UI_PREFIX}-header-title`;
    titleSpan.textContent = "Advanced Prompt Generator";
    header.appendChild(titleSpan);
    const headerControls = document.createElement("div");
    headerControls.className = `${USPM_UI_PREFIX}-header-controls`;
    const closeBtn = document.createElement("button");
    closeBtn.className = `${USPM_UI_PREFIX}-icon-button`;
    closeBtn.appendChild(createIcon(ICONS.close));
    closeBtn.onclick = () => this.toggleGeneratorWindow();
    headerControls.appendChild(closeBtn);
    header.appendChild(headerControls);

    this.ui.generatorWindow.appendChild(header);

    // This creates the accordion and all its children, and appends it
    const contentWrapper = document.createElement("div");
    contentWrapper.style.padding = "15px";
    const generatorContent = this.createGeneratorContent();

    // In standalone mode, the accordion should always be open.
    this.isAccordionOpen = true;
    generatorContent.querySelector(
      `.${UPM_UI_PREFIX}-advanced-generator-accordion-header`
    ).style.display = "none";
    generatorContent.querySelector(
      `.${UPM_UI_PREFIX}-advanced-generator-accordion-content`
    ).style.display = "block";

    contentWrapper.appendChild(generatorContent);
    this.ui.generatorWindow.appendChild(contentWrapper);

    document.body.appendChild(this.ui.generatorWindow);
    this.makeDraggable(header, this.ui.generatorWindow);
    // Standalone window does not have a resize handle in the footer, resize is on the div.
  },

  // NEW: Toggles the standalone window
  async toggleGeneratorWindow() {
    if (!this.ui.generatorWindow) {
      this.createGeneratorWindow();
    }
    const win = this.ui.generatorWindow;
    const isVisible = win.style.display !== "none";
    win.style.display = isVisible ? "none" : "flex";

    if (!isVisible) {
      await this.loadWindowPosition();
      this.ensureWindowInViewport();
    }
  },

  toggleAccordion() {
    this.isAccordionOpen = !this.isAccordionOpen;
    // Only save state if it's the integrated version
    if (
      document.getElementById(`${UPM_UI_PREFIX}-integrated-advanced-generator`)
    ) {
      chrome.storage.local.set({
        upmAdvGenAccordionOpen_v1: this.isAccordionOpen,
      });
    }

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

  handlePrimaryAction(isApply) {
    if (!this.ui.generatedPromptTextarea || !this.ui.primaryActionBtn) return;
    const promptToActOn = this.ui.generatedPromptTextarea.value;
    if (!promptToActOn) return;

    if (isApply) {
      const targetTextarea = MANAGER_CONFIGS.prompt.targetInputSelector();
      if (targetTextarea) {
        applyReactControlledInputPreset(
          targetTextarea,
          promptToActOn,
          `${UPM_UI_PREFIX}-AdvGen-Integrated`,
          logger
        );
        this.showFeedbackOnButton(this.ui.primaryActionBtn, "Applied!");
      } else {
        alert(
          `[${UPM_UI_PREFIX} Gen] Could not find the main Udio prompt textarea.`
        );
      }
    } else {
      navigator.clipboard
        .writeText(promptToActOn)
        .then(() => {
          this.showFeedbackOnButton(this.ui.primaryActionBtn, "Copied!");
        })
        .catch((err) => {
          logger.error("Failed to copy prompt:", err);
          this.showFeedbackOnButton(this.ui.primaryActionBtn, "Error!", true);
        });
    }
  },

  showFeedbackOnButton(button, message, isError = false) {
    const originalContent = button.innerHTML;
    const transientClass = isError
      ? `${UPM_UI_PREFIX}-error-transient`
      : `${UPM_UI_PREFIX}-copied-transient`;
    button.innerHTML = `${createIcon(ICONS.confirm).outerHTML} ${message}`;
    button.classList.add(transientClass);
    setTimeout(() => {
      button.innerHTML = originalContent;
      button.classList.remove(transientClass);
    }, 1500);
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

  // NEW: Draggable/Resizable logic for standalone window
  makeDraggable(dragHandle, elementToDrag) {
    dragHandle.onmousedown = (e) => {
      if (e.target.closest("button")) return;
      e.preventDefault();
      this.isDragging = true;
      this.dragOffsetX = e.clientX - elementToDrag.offsetLeft;
      this.dragOffsetY = e.clientY - elementToDrag.offsetTop;
      document.onmousemove = (ev) => this.dragElement(ev);
      document.onmouseup = () => this.stopDrag();
    };
  },
  dragElement(e) {
    if (!this.isDragging || !this.ui.generatorWindow) return;
    this.ui.generatorWindow.style.left = `${e.clientX - this.dragOffsetX}px`;
    this.ui.generatorWindow.style.top = `${e.clientY - this.dragOffsetY}px`;
  },
  stopDrag() {
    this.isDragging = false;
    document.onmouseup = null;
    document.onmousemove = null;
    this.saveWindowPosition();
    this.ensureWindowInViewport();
  },
  async saveWindowPosition() {
    if (!this.ui.generatorWindow) return;
    const pos = {
      top: this.ui.generatorWindow.offsetTop,
      left: this.ui.generatorWindow.offsetLeft,
    };
    await chrome.storage.local.set({
      [this.storageKeys.position]: JSON.stringify(pos),
    });
  },
  async loadWindowPosition() {
    if (!this.ui.generatorWindow) return;
    const data = await chrome.storage.local.get(this.storageKeys.position);
    if (data[this.storageKeys.position]) {
      const pos = JSON.parse(data[this.storageKeys.position]);
      this.ui.generatorWindow.style.top = `${pos.top}px`;
      this.ui.generatorWindow.style.left = `${pos.left}px`;
    } else {
      this.setDefaultPosition();
    }
  },
  setDefaultPosition() {
    if (!this.ui.generatorWindow) return;
    const win = this.ui.generatorWindow;
    const winWidth = win.offsetWidth;
    const winHeight = win.offsetHeight;
    win.style.top = `${Math.max(10, (window.innerHeight - winHeight) / 2)}px`;
    win.style.left = `${Math.max(10, (window.innerWidth - winWidth) / 2)}px`;
  },
  ensureWindowInViewport() {
    if (!this.ui.generatorWindow) return;
    const win = this.ui.generatorWindow;
    let rect = win.getBoundingClientRect();
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    let newL = rect.left;
    let newT = rect.top;
    if (rect.left < 0) newL = 10;
    if (rect.right > vpW) newL = Math.max(10, vpW - rect.width - 10);
    if (rect.top < 0) newT = 10;
    if (rect.bottom > vpH) newT = Math.max(10, vpH - rect.height - 10);
    win.style.left = `${Math.round(newL)}px`;
    win.style.top = `${Math.round(newT)}px`;
  },
};
