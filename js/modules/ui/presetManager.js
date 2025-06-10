// js/modules/ui/presetManager.js

import { Logger } from "@/modules/logger.js";
import { USPM_UI_PREFIX, ICONS } from "@/modules/config.js";
import {
  createIcon,
  applyReactControlledInputPreset,
} from "@/modules/utils.js";
import { sharedConfirmDialog } from "./sharedDialog.js";
import { UdioIntegration } from "./integration.js";
import { idb } from "../idb.js";

const logger = new Logger("PresetManager");

export class PresetManager {
  constructor(config) {
    this.config = {
      ...config,
      // Pass the logger instance from this class when calling the util function
      applyPreset: (el, val, id) =>
        applyReactControlledInputPreset(el, val, id, logger),
    };

    this.presets = [];
    this.ui = {
      managerWindow: null,
      presetListContainer: null,
      newPresetNameInput: null,
      newPresetValueInput: null,
      newPresetPositionInput: null,
      newPresetPositionTotalSpan: null,
      resizeHandle: null,
      managerPaginationControls: null,
    };
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.isResizing = false;
    this.resizeStartX = 0;
    this.resizeStartWidth = 0;
    this.editingPresetIndex = null;
    this.originalAddButtonText = null;
    this.originalAddButtonOnClick = null;
    this.draggedPresetElement = null;
    this.draggedPresetOriginalIndex = -1;

    this.DEFAULT_ITEMS_PER_MANAGER_PAGE = 20;
    this.itemsPerPageManager = this.DEFAULT_ITEMS_PER_MANAGER_PAGE;
    this.managerCurrentPage = 1;
    this.pageChangeTimer = null;
    this.PAGE_CHANGE_DRAG_HOVER_DELAY = 750;
  }

  async loadPresets() {
    try {
      const stored = await idb.get(this.config.storageKey);
      if (stored) {
        if (
          Array.isArray(stored) &&
          stored.every(
            (p) => typeof p === "object" && "name" in p && "value" in p
          )
        ) {
          this.presets = stored;
        } else {
          this.presets = [];
          logger.warn(
            `Invalid preset format in IndexedDB for '${this.config.id}', resetting.`
          );
        }
      }
    } catch (e) {
      this.presets = [];
      logger.error(
        `Failed to load presets for '${this.config.id}' from IndexedDB:`,
        e
      );
    }
  }

  async savePresets() {
    try {
      await idb.put(this.config.storageKey, this.presets);
      // Refresh integrated UI only if on Udio page
      if (window.location.hostname.includes("udio.com")) {
        UdioIntegration.refreshIntegratedUI();
      }
    } catch (e) {
      logger.error(
        `Failed to save presets for '${this.config.id}' to IndexedDB:`,
        e
      );
    }
  }

  addPreset(name, value) {
    if (this.editingPresetIndex !== null) {
      this.cancelEditPreset();
    }
    if (!name?.trim() || value === undefined) {
      alert("Preset name cannot be empty.");
      return;
    }
    const trimmedName = name.trim();
    const trimmedValue = value.trim();
    if (
      this.presets.some(
        (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      alert(`A preset with the name "${trimmedName}" already exists.`);
      return;
    }
    this.presets.unshift({ name: trimmedName, value: trimmedValue });
    this.savePresets();
    this.renderPresetList();
    if (this.ui.newPresetNameInput && this.ui.newPresetValueInput) {
      this.ui.newPresetNameInput.value = "";
      this.ui.newPresetValueInput.value = "";
      this.ui.newPresetNameInput.focus();
    }
    if (window.location.hostname.includes("udio.com")) {
      UdioIntegration.refreshIntegratedUI();
    }
  }

  deletePreset(indexInFullArray) {
    if (this.editingPresetIndex === indexInFullArray) {
      this.cancelEditPreset();
    }
    if (indexInFullArray < 0 || indexInFullArray >= this.presets.length) return;
    this.presets.splice(indexInFullArray, 1);
    this.savePresets();
    const totalPages = Math.ceil(
      this.presets.length / this.itemsPerPageManager
    );
    if (this.managerCurrentPage > totalPages && totalPages > 0) {
      this.managerCurrentPage = totalPages;
    } else if (totalPages === 0) {
      this.managerCurrentPage = 1;
    }
    this.renderPresetList();
    if (window.location.hostname.includes("udio.com")) {
      UdioIntegration.refreshIntegratedUI();
    }
  }

  _handlePageButtonDragOver(event, isNextButton) {
    event.preventDefault();
    if (!this.draggedPresetElement) return;
    const button = event.currentTarget;
    button.classList.add(`${USPM_UI_PREFIX}-page-btn-drag-hotspot`);
    if (!this.pageChangeTimer) {
      this.pageChangeTimer = setTimeout(() => {
        if (isNextButton) {
          if (
            this.managerCurrentPage <
            Math.ceil(this.presets.length / this.itemsPerPageManager)
          ) {
            this.managerCurrentPage++;
            this.renderPresetList();
          }
        } else {
          if (this.managerCurrentPage > 1) {
            this.managerCurrentPage--;
            this.renderPresetList();
          }
        }
        this.pageChangeTimer = null;
      }, this.PAGE_CHANGE_DRAG_HOVER_DELAY);
    }
  }

  _handlePageButtonDragLeave(event) {
    event.currentTarget.classList.remove(
      `${USPM_UI_PREFIX}-page-btn-drag-hotspot`
    );
    if (this.pageChangeTimer) {
      clearTimeout(this.pageChangeTimer);
      this.pageChangeTimer = null;
    }
  }

  applyPresetToTarget(value, event) {
    const targetInput = this.config.targetInputSelector();

    // If a target exists on the page (i.e., we are on Udio.com), apply the preset.
    if (targetInput) {
      this.config.applyPreset(targetInput, value, this.config.id);
    }
    // Otherwise, copy the value to the clipboard.
    else {
      navigator.clipboard
        .writeText(value)
        .then(() => {
          const itemElement = event.target.closest(
            `.${USPM_UI_PREFIX}-preset-item`
          );
          if (itemElement) {
            const originalContent = itemElement.innerHTML;
            itemElement.classList.add(`${USPM_UI_PREFIX}-copied-transient`);
            const nameSpan = itemElement.querySelector(
              `.${USPM_UI_PREFIX}-preset-name`
            );
            if (nameSpan) {
              nameSpan.innerHTML = `${
                createIcon(ICONS.copy).outerHTML
              } Copied!`;
            }

            setTimeout(() => {
              itemElement.classList.remove(
                `${USPM_UI_PREFIX}-copied-transient`
              );
              itemElement.innerHTML = originalContent; // Restore original content to re-attach listeners
              this.reAttachItemListeners(itemElement, value);
            }, 1500);
          }
        })
        .catch((err) => {
          logger.error("Failed to copy text: ", err);
        });
    }
  }

  // Helper to re-attach listeners after innerHTML is overwritten
  reAttachItemListeners(itemElement, presetValue) {
    const originalIndex = parseInt(itemElement.dataset.originalIndex, 10);
    itemElement.onclick = (e) => {
      if (e.target.closest("button")) return;
      this.applyPresetToTarget(presetValue, e);
    };
    const editBtn = itemElement.querySelector(`.${USPM_UI_PREFIX}-edit-btn`);
    if (editBtn) {
      editBtn.onclick = (e) => {
        e.stopPropagation();
        this.startEditPreset(originalIndex);
      };
    }
    const deleteBtn = itemElement.querySelector(
      `.${USPM_UI_PREFIX}-delete-btn`
    );
    if (deleteBtn) {
      const presetName = this.presets[originalIndex].name;
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        this.showConfirm(`Delete preset "${presetName}"?`, () =>
          this.deletePreset(originalIndex)
        );
      };
    }
  }

  renderPresetList() {
    if (!this.ui.presetListContainer || !this.ui.managerPaginationControls)
      return;
    this.ui.presetListContainer.innerHTML = "";
    this.ui.managerPaginationControls.innerHTML = "";

    if (this.presets.length === 0) {
      this.ui.presetListContainer.innerHTML = `<p class="${USPM_UI_PREFIX}-no-presets ${USPM_UI_PREFIX}-no-presets-${this.config.id}">No presets yet.</p>`;
      this.ui.managerPaginationControls.style.display = "none";
      return;
    }

    const totalPresets = this.presets.length;
    const totalPages = Math.ceil(totalPresets / this.itemsPerPageManager);
    if (this.managerCurrentPage > totalPages && totalPages > 0)
      this.managerCurrentPage = totalPages;
    if (this.managerCurrentPage < 1) this.managerCurrentPage = 1;

    const startIndex = (this.managerCurrentPage - 1) * this.itemsPerPageManager;
    const endIndex = Math.min(
      startIndex + this.itemsPerPageManager,
      totalPresets
    );
    const presetsToDisplay = this.presets.slice(startIndex, endIndex);

    presetsToDisplay.forEach((preset, indexInPage) => {
      const originalIndex = startIndex + indexInPage;
      const item = document.createElement("div");
      item.className = `${USPM_UI_PREFIX}-preset-item ${USPM_UI_PREFIX}-preset-item-${this.config.id}`;
      item.title = `Value: ${preset.value}`;
      item.draggable = true;
      item.dataset.originalIndex = originalIndex;
      item.onclick = (e) => {
        if (e.target.closest("button")) return;
        this.applyPresetToTarget(preset.value, e);
      };

      const nameSpan = document.createElement("span");
      nameSpan.className = `${USPM_UI_PREFIX}-preset-name`;
      nameSpan.textContent = preset.name;
      item.appendChild(nameSpan);

      const controlsDiv = document.createElement("div");
      controlsDiv.className = `${USPM_UI_PREFIX}-preset-item-controls`;

      const editBtn = document.createElement("button");
      editBtn.className = `${USPM_UI_PREFIX}-icon-button ${USPM_UI_PREFIX}-edit-btn`;
      editBtn.appendChild(createIcon(ICONS.edit));
      editBtn.title = "Edit";
      editBtn.onclick = (e) => {
        e.stopPropagation();
        this.startEditPreset(originalIndex);
      };
      controlsDiv.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = `${USPM_UI_PREFIX}-icon-button ${USPM_UI_PREFIX}-delete-btn`;
      deleteBtn.appendChild(createIcon(ICONS.delete));
      deleteBtn.title = "Delete";
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        this.showConfirm(`Delete preset "${preset.name}"?`, () =>
          this.deletePreset(originalIndex)
        );
      };
      controlsDiv.appendChild(deleteBtn);

      item.appendChild(controlsDiv);
      this.ui.presetListContainer.appendChild(item);

      item.addEventListener("dragstart", this._handleDragStart.bind(this));
      item.addEventListener("dragend", this._handleDragEnd.bind(this));
    });

    if (totalPages > 1) {
      this.ui.managerPaginationControls.style.display = "flex";
      const prevBtn = document.createElement("button");
      prevBtn.className = `${USPM_UI_PREFIX}-page-btn ${USPM_UI_PREFIX}-page-prev`;
      prevBtn.appendChild(createIcon(ICONS.prev));
      prevBtn.disabled = this.managerCurrentPage <= 1;
      prevBtn.onclick = () => {
        if (this.managerCurrentPage > 1) {
          this.managerCurrentPage--;
          this.renderPresetList();
        }
      };
      prevBtn.addEventListener("dragover", (e) =>
        this._handlePageButtonDragOver(e, false)
      );
      prevBtn.addEventListener(
        "dragleave",
        this._handlePageButtonDragLeave.bind(this)
      );

      const pageInfo = document.createElement("span");
      pageInfo.className = `${USPM_UI_PREFIX}-page-info`;
      pageInfo.textContent = `Page ${this.managerCurrentPage} / ${totalPages}`;

      const nextBtn = document.createElement("button");
      nextBtn.className = `${USPM_UI_PREFIX}-page-btn ${USPM_UI_PREFIX}-page-next`;
      nextBtn.appendChild(createIcon(ICONS.next));
      nextBtn.disabled = this.managerCurrentPage >= totalPages;
      nextBtn.onclick = () => {
        if (this.managerCurrentPage < totalPages) {
          this.managerCurrentPage++;
          this.renderPresetList();
        }
      };
      nextBtn.addEventListener("dragover", (e) =>
        this._handlePageButtonDragOver(e, true)
      );
      nextBtn.addEventListener(
        "dragleave",
        this._handlePageButtonDragLeave.bind(this)
      );

      this.ui.managerPaginationControls.appendChild(prevBtn);
      this.ui.managerPaginationControls.appendChild(pageInfo);
      this.ui.managerPaginationControls.appendChild(nextBtn);
    } else {
      this.ui.managerPaginationControls.style.display = "none";
    }
  }

  _handleDragStart(e) {
    this.draggedPresetElement = e.target.closest(
      `.${USPM_UI_PREFIX}-preset-item`
    );
    if (!this.draggedPresetElement) return;
    this.draggedPresetOriginalIndex = parseInt(
      this.draggedPresetElement.dataset.originalIndex
    );
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "text/plain",
      this.draggedPresetOriginalIndex.toString()
    );
    this.draggedPresetElement.classList.add(`${USPM_UI_PREFIX}-dragging-item`);
    this.ui.presetListContainer.classList.add(
      `${USPM_UI_PREFIX}-list-dragging-active`
    );
  }

  _handleDragEnd(e) {
    if (this.draggedPresetElement) {
      this.draggedPresetElement.classList.remove(
        `${USPM_UI_PREFIX}-dragging-item`
      );
    }
    this.ui.presetListContainer
      .querySelectorAll(`.${USPM_UI_PREFIX}-drag-over-target`)
      .forEach((el) =>
        el.classList.remove(`${USPM_UI_PREFIX}-drag-over-target`)
      );
    this.ui.presetListContainer.classList.remove(
      `${USPM_UI_PREFIX}-list-dragging-active`
    );
    this.draggedPresetElement = null;
    this.draggedPresetOriginalIndex = -1;
    if (this.pageChangeTimer) {
      clearTimeout(this.pageChangeTimer);
      this.pageChangeTimer = null;
    }
    this.ui.managerPaginationControls
      .querySelectorAll(`.${USPM_UI_PREFIX}-page-btn-drag-hotspot`)
      .forEach((b) =>
        b.classList.remove(`${USPM_UI_PREFIX}-page-btn-drag-hotspot`)
      );
    if (window.location.hostname.includes("udio.com")) {
      UdioIntegration.refreshIntegratedUI();
    }
  }

  _handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (
      !this.ui.presetListContainer.classList.contains(
        `${USPM_UI_PREFIX}-list-dragging-active`
      )
    )
      return;
    const targetItem = e.target.closest(`.${USPM_UI_PREFIX}-preset-item`);
    this.ui.presetListContainer
      .querySelectorAll(`.${USPM_UI_PREFIX}-drag-over-target`)
      .forEach((el) =>
        el.classList.remove(`${USPM_UI_PREFIX}-drag-over-target`)
      );
    if (targetItem && targetItem !== this.draggedPresetElement) {
      targetItem.classList.add(`${USPM_UI_PREFIX}-drag-over-target`);
    }
  }

  _handleDragLeave(e) {
    const targetItem = e.target.closest(`.${USPM_UI_PREFIX}-preset-item`);
    if (targetItem && !targetItem.contains(e.relatedTarget)) {
      targetItem.classList.remove(`${USPM_UI_PREFIX}-drag-over-target`);
    }
  }

  _handleDrop(e) {
    e.preventDefault();
    if (!this.draggedPresetElement || this.draggedPresetOriginalIndex === -1)
      return;
    const targetItemElement = e.target.closest(
      `.${USPM_UI_PREFIX}-preset-item`
    );
    this.ui.presetListContainer
      .querySelectorAll(`.${USPM_UI_PREFIX}-drag-over-target`)
      .forEach((el) =>
        el.classList.remove(`${USPM_UI_PREFIX}-drag-over-target`)
      );
    if (!targetItemElement || targetItemElement === this.draggedPresetElement)
      return;

    const fromIndex = this.draggedPresetOriginalIndex;
    const toIndex = parseInt(targetItemElement.dataset.originalIndex);
    if (fromIndex === toIndex) return;

    const itemToMove = this.presets.splice(fromIndex, 1)[0];
    this.presets.splice(toIndex, 0, itemToMove);
    this.savePresets();
    this.renderPresetList();
    if (window.location.hostname.includes("udio.com")) {
      UdioIntegration.refreshIntegratedUI();
    }
  }

  startEditPreset(index) {
    if (index < 0 || index >= this.presets.length) return;
    this.editingPresetIndex = index;
    const preset = this.presets[index];
    if (
      this.ui.newPresetNameInput &&
      this.ui.newPresetValueInput &&
      this.ui.newPresetPositionInput &&
      this.ui.newPresetPositionTotalSpan &&
      this.ui.managerWindow
    ) {
      this.ui.newPresetNameInput.value = preset.name;
      this.ui.newPresetValueInput.value = preset.value;
      this.ui.newPresetPositionInput.value = index + 1;
      this.ui.newPresetPositionInput.max = this.presets.length.toString();
      this.ui.newPresetPositionTotalSpan.textContent = ` of ${this.presets.length}`;
      this.ui.newPresetPositionInput.style.display = "inline-block";
      this.ui.newPresetPositionTotalSpan.style.display = "inline-block";
      this.ui.newPresetNameInput.focus();

      const addButton = this.ui.managerWindow.querySelector(
        `.${USPM_UI_PREFIX}-add-btn-${this.config.id}`
      );
      if (addButton) {
        if (!this.originalAddButtonOnClick) {
          this.originalAddButtonText = addButton.innerHTML;
          this.originalAddButtonOnClick = addButton.onclick;
        }
        addButton.innerHTML = "";
        addButton.appendChild(createIcon(ICONS.save));
        addButton.appendChild(document.createTextNode(" Save Edit"));
        addButton.onclick = () => this.saveEditedPreset();
      }
      this.addCancelEditButton(addButton);
    }
  }

  addCancelEditButton(addButtonReference) {
    if (!this.ui.managerWindow) return;
    let cancelBtn = this.ui.managerWindow.querySelector(
      `.${USPM_UI_PREFIX}-cancel-edit-btn`
    );
    const addControlsContainer = this.ui.managerWindow.querySelector(
      `.${USPM_UI_PREFIX}-add-controls-container`
    );
    if (!cancelBtn && addControlsContainer) {
      cancelBtn = document.createElement("button");
      cancelBtn.className = `${USPM_UI_PREFIX}-text-button secondary ${USPM_UI_PREFIX}-cancel-edit-btn`;
      cancelBtn.appendChild(createIcon(ICONS.cancel));
      cancelBtn.appendChild(document.createTextNode(" Cancel"));
      addControlsContainer.insertBefore(cancelBtn, addButtonReference);
    }
    if (cancelBtn) {
      cancelBtn.onclick = () => this.cancelEditPreset();
      cancelBtn.style.display = "inline-flex";
    }
  }

  removeCancelEditButton() {
    if (!this.ui.managerWindow) return;
    const cancelBtn = this.ui.managerWindow.querySelector(
      `.${USPM_UI_PREFIX}-cancel-edit-btn`
    );
    if (cancelBtn) {
      cancelBtn.remove();
    }
  }

  cancelEditPreset() {
    this.editingPresetIndex = null;
    if (this.ui.newPresetNameInput && this.ui.newPresetValueInput) {
      this.ui.newPresetNameInput.value = "";
      this.ui.newPresetValueInput.value = "";
    }
    if (this.ui.newPresetPositionInput) {
      this.ui.newPresetPositionInput.value = "";
      this.ui.newPresetPositionInput.style.display = "none";
    }
    if (this.ui.newPresetPositionTotalSpan) {
      this.ui.newPresetPositionTotalSpan.textContent = "";
      this.ui.newPresetPositionTotalSpan.style.display = "none";
    }
    this.restoreAddButton();
    this.removeCancelEditButton();
  }

  restoreAddButton() {
    if (!this.ui.managerWindow) return;
    const addButton = this.ui.managerWindow.querySelector(
      `.${USPM_UI_PREFIX}-add-btn-${this.config.id}`
    );
    if (
      addButton &&
      this.originalAddButtonText !== null &&
      this.originalAddButtonOnClick !== null
    ) {
      addButton.innerHTML = this.originalAddButtonText;
      addButton.onclick = this.originalAddButtonOnClick;
      this.originalAddButtonText = null;
      this.originalAddButtonOnClick = null;
    } else if (addButton) {
      addButton.innerHTML = "";
      addButton.appendChild(createIcon(ICONS.add));
      addButton.appendChild(document.createTextNode(" Add Preset"));
      addButton.onclick = () =>
        this.addPreset(
          this.ui.newPresetNameInput.value,
          this.ui.newPresetValueInput.value
        );
    }
  }

  saveEditedPreset() {
    if (
      this.editingPresetIndex === null ||
      this.editingPresetIndex < 0 ||
      this.editingPresetIndex >= this.presets.length
    ) {
      this.cancelEditPreset();
      return;
    }
    if (
      !this.ui.newPresetNameInput ||
      !this.ui.newPresetValueInput ||
      !this.ui.newPresetPositionInput
    )
      return;

    const newName = this.ui.newPresetNameInput.value.trim();
    const newValue = this.ui.newPresetValueInput.value.trim();
    if (!newName) {
      alert("Preset name cannot be empty.");
      return;
    }
    const conflictingPreset = this.presets.find(
      (p, i) =>
        i !== this.editingPresetIndex &&
        p.name.toLowerCase() === newName.toLowerCase()
    );
    if (conflictingPreset) {
      alert(`A preset with the name "${newName}" already exists.`);
      return;
    }

    let newPosition = parseInt(this.ui.newPresetPositionInput.value, 10) - 1;
    if (
      isNaN(newPosition) ||
      newPosition < 0 ||
      newPosition >= this.presets.length
    ) {
      alert(`Invalid position. Must be between 1 and ${this.presets.length}.`);
      this.ui.newPresetPositionInput.focus();
      return;
    }

    this.presets[this.editingPresetIndex].name = newName;
    this.presets[this.editingPresetIndex].value = newValue;

    if (newPosition !== this.editingPresetIndex) {
      const itemToMove = this.presets.splice(this.editingPresetIndex, 1)[0];
      this.presets.splice(newPosition, 0, itemToMove);
    }

    this.savePresets();
    this.renderPresetList();
    this.cancelEditPreset();
    if (this.ui.newPresetNameInput) this.ui.newPresetNameInput.focus();
    if (window.location.hostname.includes("udio.com")) {
      UdioIntegration.refreshIntegratedUI();
    }
  }

  createManagerWindow() {
    if (document.getElementById(`${USPM_UI_PREFIX}-window-${this.config.id}`)) {
      this.ui.managerWindow = document.getElementById(
        `${USPM_UI_PREFIX}-window-${this.config.id}`
      );
      return;
    }

    this.ui.managerWindow = document.createElement("div");
    this.ui.managerWindow.id = `${USPM_UI_PREFIX}-window-${this.config.id}`;
    this.ui.managerWindow.className = `${USPM_UI_PREFIX}-window`;
    this.ui.managerWindow.style.display = "none";

    const header = document.createElement("div");
    header.className = `${USPM_UI_PREFIX}-header`;
    const dragHandle = createIcon(
      ICONS.drag_handle,
      `${USPM_UI_PREFIX}-drag-handle-icon`
    );
    header.appendChild(dragHandle);
    const titleSpan = document.createElement("span");
    titleSpan.className = `${USPM_UI_PREFIX}-header-title`;
    titleSpan.textContent = this.config.uiTitle;
    header.appendChild(titleSpan);
    const headerControls = document.createElement("div");
    headerControls.className = `${USPM_UI_PREFIX}-header-controls`;
    const sortBtn = this.createHeaderButton(
      ICONS.sort_alpha,
      "Sort A-Z",
      this.sortPresetsByName.bind(this)
    );
    headerControls.appendChild(sortBtn);
    const closeBtn = this.createHeaderButton(
      ICONS.close,
      "Close",
      this.toggleManagerWindow.bind(this)
    );
    headerControls.appendChild(closeBtn);
    header.appendChild(headerControls);
    this.ui.managerWindow.appendChild(header);

    this.ui.presetListContainer = document.createElement("div");
    this.ui.presetListContainer.className = `${USPM_UI_PREFIX}-list-container`;
    this.ui.presetListContainer.addEventListener(
      "dragover",
      this._handleDragOver.bind(this)
    );
    this.ui.presetListContainer.addEventListener(
      "drop",
      this._handleDrop.bind(this)
    );
    this.ui.presetListContainer.addEventListener(
      "dragleave",
      this._handleDragLeave.bind(this)
    );
    this.ui.managerWindow.appendChild(this.ui.presetListContainer);

    this.ui.managerPaginationControls = document.createElement("div");
    this.ui.managerPaginationControls.className = `${USPM_UI_PREFIX}-manager-pagination-controls`;
    this.ui.managerWindow.appendChild(this.ui.managerPaginationControls);

    const addArea = document.createElement("div");
    addArea.className = `${USPM_UI_PREFIX}-add-area`;
    const nameAndPositionContainer = document.createElement("div");
    nameAndPositionContainer.className = `${USPM_UI_PREFIX}-name-pos-container`;
    this.ui.newPresetNameInput = document.createElement("input");
    this.ui.newPresetNameInput.type = "text";
    this.ui.newPresetNameInput.placeholder = "Preset Name";
    this.ui.newPresetNameInput.className = `${USPM_UI_PREFIX}-input ${USPM_UI_PREFIX}-name-input`;
    nameAndPositionContainer.appendChild(this.ui.newPresetNameInput);
    this.ui.newPresetPositionInput = document.createElement("input");
    this.ui.newPresetPositionInput.type = "number";
    this.ui.newPresetPositionInput.className = `${USPM_UI_PREFIX}-input ${USPM_UI_PREFIX}-pos-input`;
    this.ui.newPresetPositionInput.style.display = "none";
    this.ui.newPresetPositionInput.min = "1";
    nameAndPositionContainer.appendChild(this.ui.newPresetPositionInput);
    this.ui.newPresetPositionTotalSpan = document.createElement("span");
    this.ui.newPresetPositionTotalSpan.className = `${USPM_UI_PREFIX}-pos-total`;
    this.ui.newPresetPositionTotalSpan.style.display = "none";
    nameAndPositionContainer.appendChild(this.ui.newPresetPositionTotalSpan);
    addArea.appendChild(nameAndPositionContainer);

    this.ui.newPresetValueInput = document.createElement("input");
    this.ui.newPresetValueInput.type = "text";
    this.ui.newPresetValueInput.placeholder =
      this.config.id === "prompt"
        ? "Prompt text..."
        : "Style reduction text...";
    this.ui.newPresetValueInput.className = `${USPM_UI_PREFIX}-input`;
    addArea.appendChild(this.ui.newPresetValueInput);

    const addControlsContainer = document.createElement("div");
    addControlsContainer.className = `${USPM_UI_PREFIX}-add-controls-container`;
    const addButton = document.createElement("button");
    addButton.className = `${USPM_UI_PREFIX}-text-button ${USPM_UI_PREFIX}-add-btn ${USPM_UI_PREFIX}-add-btn-${this.config.id}`;
    this.originalAddButtonText = `${createIcon(ICONS.add).outerHTML}Add Preset`;
    this.originalAddButtonOnClick = () =>
      this.addPreset(
        this.ui.newPresetNameInput.value,
        this.ui.newPresetValueInput.value
      );
    addButton.innerHTML = this.originalAddButtonText;
    addButton.onclick = this.originalAddButtonOnClick;
    addControlsContainer.appendChild(addButton);
    addArea.appendChild(addControlsContainer);
    this.ui.managerWindow.appendChild(addArea);

    const footer = document.createElement("div");
    footer.className = `${USPM_UI_PREFIX}-footer`;
    const importBtn = this.createFooterButton(
      ICONS.upload,
      "Import",
      this.handleImport.bind(this)
    );
    const exportBtn = this.createFooterButton(
      ICONS.download,
      "Export",
      this.handleExport.bind(this)
    );
    const loadDefaultsBtn = this.createFooterButton(
      ICONS.library_add,
      "Load Defaults",
      this.loadDefaultPresets.bind(this)
    );
    const deleteAllBtn = this.createFooterButton(
      ICONS.delete_forever,
      "Delete All",
      this.deleteAllPresets.bind(this),
      `${USPM_UI_PREFIX}-footer-btn-danger`
    );
    footer.appendChild(importBtn);
    footer.appendChild(exportBtn);
    footer.appendChild(loadDefaultsBtn);
    footer.appendChild(deleteAllBtn);
    this.ui.managerWindow.appendChild(footer);

    this.ui.resizeHandle = document.createElement("div");
    this.ui.resizeHandle.className = `${USPM_UI_PREFIX}-resize-handle`;
    this.ui.resizeHandle.innerHTML = "↔";
    this.ui.managerWindow.appendChild(this.ui.resizeHandle);

    this.makeResizable(this.ui.resizeHandle, this.ui.managerWindow);
    document.body.appendChild(this.ui.managerWindow);
    this.makeDraggable(header, this.ui.managerWindow);
    this.loadWindowPosition();
    this.loadWindowSize();
    this.ensureWindowInViewport();
  }

  createHeaderButton(icon, title, onClickHandler) {
    const btn = document.createElement("button");
    btn.className = `${USPM_UI_PREFIX}-icon-button ${USPM_UI_PREFIX}-header-action-btn`;
    btn.title = title;
    btn.appendChild(createIcon(icon));
    btn.onclick = onClickHandler;
    return btn;
  }

  sortPresetsByName() {
    this.presets.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    this.savePresets();
    this.renderPresetList();
    if (window.location.hostname.includes("udio.com")) {
      UdioIntegration.refreshIntegratedUI();
    }
  }

  createFooterButton(icon, title, onClickHandler, extraClass = "") {
    const btn = document.createElement("button");
    btn.className = `${USPM_UI_PREFIX}-icon-button ${USPM_UI_PREFIX}-footer-btn ${extraClass}`;
    btn.title = title;
    btn.appendChild(createIcon(icon));
    btn.onclick = onClickHandler;
    return btn;
  }

  async toggleManagerWindow() {
    if (
      !this.ui.managerWindow ||
      !document.body.contains(this.ui.managerWindow)
    ) {
      this.createManagerWindow();
    }
    if (this.editingPresetIndex !== null) {
      this.cancelEditPreset();
    }

    const win = this.ui.managerWindow;
    const isVisible = win.style.display !== "none";
    win.style.display = isVisible ? "none" : "flex"; // Changed to flex for proper layout
    if (!isVisible) {
      this.itemsPerPageManager = this.DEFAULT_ITEMS_PER_MANAGER_PAGE;
      this.managerCurrentPage = 1;
      await this.loadWindowSize();
      this.renderPresetList();
      if (this.ui.newPresetNameInput) this.ui.newPresetNameInput.focus();
      this.ensureWindowInViewport();
    }
  }

  makeDraggable(dragHandle, elementToDrag) {
    dragHandle.onmousedown = (e) => {
      if (
        e.target.closest(
          `.${USPM_UI_PREFIX}-icon-button, .${USPM_UI_PREFIX}-resize-handle, .${USPM_UI_PREFIX}-header-title`
        )
      ) {
        if (
          e.target.closest(`.${USPM_UI_PREFIX}-header-title`) ||
          e.target.classList.contains(`${USPM_UI_PREFIX}-drag-handle-icon`)
        ) {
        } else {
          return;
        }
      }
      e.preventDefault();
      this.isDragging = true;
      const rect = elementToDrag.getBoundingClientRect();
      this.dragOffsetX = e.clientX - rect.left;
      this.dragOffsetY = e.clientY - rect.top;
      document.onmousemove = this.dragElement.bind(this);
      document.onmouseup = this.stopDrag.bind(this);
      dragHandle.style.cursor = "grabbing";
      const dragIcon = dragHandle.querySelector(
        `.${USPM_UI_PREFIX}-drag-handle-icon`
      );
      if (dragIcon) dragIcon.style.cursor = "grabbing";
    };
  }

  dragElement(e) {
    if (!this.isDragging || !this.ui.managerWindow) return;
    e.preventDefault();
    this.ui.managerWindow.style.left = `${e.clientX - this.dragOffsetX}px`;
    this.ui.managerWindow.style.top = `${e.clientY - this.dragOffsetY}px`;
  }

  stopDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;
    document.onmouseup = null;
    document.onmousemove = null;
    const dragHandle = this.ui.managerWindow?.querySelector(
      `.${USPM_UI_PREFIX}-header`
    );
    if (dragHandle) dragHandle.style.cursor = "grab";
    const dragIcon = this.ui.managerWindow?.querySelector(
      `.${USPM_UI_PREFIX}-drag-handle-icon`
    );
    if (dragIcon) dragIcon.style.cursor = "grab";
    this.saveWindowPosition();
    this.ensureWindowInViewport();
  }

  makeResizable(resizeHandle, elementToResize) {
    resizeHandle.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isResizing = true;
      this.resizeStartX = e.clientX;
      this.resizeStartWidth = parseInt(
        document.defaultView.getComputedStyle(elementToResize).width,
        10
      );
      document.body.style.cursor = "ew-resize";
      resizeHandle.style.cursor = "ew-resize";
      document.onmousemove = this.resizeElement.bind(this);
      document.onmouseup = this.stopResize.bind(this);
    };
  }

  resizeElement(e) {
    if (!this.isResizing || !this.ui.managerWindow) return;
    e.preventDefault();
    const cs = document.defaultView.getComputedStyle(this.ui.managerWindow);
    const minWidth = parseInt(cs.minWidth, 10) || 300;
    const maxWidth = window.innerWidth * 0.95;
    let newWidth = this.resizeStartWidth + (e.clientX - this.resizeStartX);
    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    this.ui.managerWindow.style.width = `${newWidth}px`;
  }

  stopResize() {
    if (!this.isResizing) return;
    this.isResizing = false;
    document.onmousemove = null;
    document.onmouseup = null;
    if (this.ui.resizeHandle) this.ui.resizeHandle.style.cursor = "ew-resize";
    document.body.style.cursor = "default";
    this.saveWindowSize();
    this.ensureWindowInViewport();
  }

  updateVisibleItemsInManager() {
    if (
      this.ui.managerWindow &&
      this.ui.managerWindow.style.display !== "none"
    ) {
      this.itemsPerPageManager = this.DEFAULT_ITEMS_PER_MANAGER_PAGE;
      this.renderPresetList();
    }
  }

  async saveWindowSize() {
    if (!this.ui.managerWindow) return;
    const size = { width: this.ui.managerWindow.style.width };
    if (size.width) {
      await chrome.storage.local.set({
        [this.config.uiSizeStorageKey]: JSON.stringify(size),
      });
    }
  }

  applyDefaultWidth() {
    if (!this.ui.managerWindow) return;
    this.ui.managerWindow.style.width = "1200px";
  }

  async loadWindowSize() {
    if (!this.ui.managerWindow) return this.applyDefaultWidth();
    const data = await chrome.storage.local.get(this.config.uiSizeStorageKey);
    const storedSize = data[this.config.uiSizeStorageKey];
    if (storedSize) {
      try {
        const size = JSON.parse(storedSize);
        if (size.width && CSS.supports("width", size.width)) {
          this.ui.managerWindow.style.width = size.width;
        } else {
          this.applyDefaultWidth();
        }
      } catch (e) {
        this.applyDefaultWidth();
      }
    } else {
      this.applyDefaultWidth();
    }
    this.updateVisibleItemsInManager();
  }

  async saveWindowPosition() {
    if (!this.ui.managerWindow) return;
    const pos = {
      top: this.ui.managerWindow.offsetTop,
      left: this.ui.managerWindow.offsetLeft,
    };
    await chrome.storage.local.set({
      [this.config.uiPositionStorageKey]: JSON.stringify(pos),
    });
  }

  async loadWindowPosition() {
    if (!this.ui.managerWindow) return;
    const data = await chrome.storage.local.get(
      this.config.uiPositionStorageKey
    );
    const storedPos = data[this.config.uiPositionStorageKey];
    if (storedPos) {
      try {
        const pos = JSON.parse(storedPos);
        if (typeof pos.top === "number" && typeof pos.left === "number") {
          this.ui.managerWindow.style.top = `${pos.top}px`;
          this.ui.managerWindow.style.left = `${pos.left}px`;
        } else {
          this.setDefaultPosition();
        }
      } catch (e) {
        this.setDefaultPosition();
      }
    } else {
      this.setDefaultPosition();
    }
  }

  setDefaultPosition() {
    if (!this.ui.managerWindow) return;
    const winWidth = parseInt(this.ui.managerWindow.style.width || "1200");
    const winHeight = this.ui.managerWindow.offsetHeight;
    let defaultTop = (window.innerHeight - winHeight) / 2;
    let defaultLeft = (window.innerWidth - winWidth) / 2;
    defaultTop = Math.max(
      10,
      Math.min(defaultTop, window.innerHeight - winHeight - 10)
    );
    defaultLeft = Math.max(
      10,
      Math.min(defaultLeft, window.innerWidth - winWidth - 10)
    );
    this.ui.managerWindow.style.top = `${Math.round(defaultTop)}px`;
    this.ui.managerWindow.style.left = `${Math.round(defaultLeft)}px`;
  }

  ensureWindowInViewport() {
    if (!this.ui.managerWindow) return;
    const win = this.ui.managerWindow;
    const cs = window.getComputedStyle(win);
    let currentL = parseFloat(win.style.left);
    if (isNaN(currentL))
      currentL =
        (window.innerWidth -
          (parseFloat(win.style.width) || parseFloat(cs.minWidth) || 0)) /
        2;
    let currentT = parseFloat(win.style.top);
    if (isNaN(currentT)) currentT = (window.innerHeight - win.offsetHeight) / 2;
    let rect;
    const originalDisplay = win.style.display;
    if (originalDisplay === "none") {
      win.style.visibility = "hidden";
      win.style.display = "flex";
      rect = win.getBoundingClientRect();
      win.style.display = originalDisplay;
      win.style.visibility = "visible";
    } else {
      rect = win.getBoundingClientRect();
    }
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    let newL = currentL;
    let newT = currentT;
    if (rect.left < 0) newL = 0;
    if (rect.right > vpW) newL = Math.max(0, vpW - rect.width);
    if (rect.top < 0) newT = 0;
    if (rect.bottom > vpH) newT = Math.max(0, vpH - rect.height);
    if (
      Math.round(newL) !== Math.round(currentL) ||
      Math.round(newT) !== Math.round(currentT)
    ) {
      win.style.left = `${Math.round(newL)}px`;
      win.style.top = `${Math.round(newT)}px`;
      this.saveWindowPosition();
    }
    let currentWidth = rect.width;
    let newWidth = currentWidth;
    const minAllowedWidth = parseFloat(cs.minWidth) || 300;
    const maxAllowedWidth = parseFloat(cs.maxWidth) || vpW * 0.95;
    if (currentWidth > vpW - 20) newWidth = vpW - 20;
    newWidth = Math.max(minAllowedWidth, Math.min(newWidth, maxAllowedWidth));
    if (Math.round(newWidth) !== Math.round(currentWidth)) {
      if (Math.round(newWidth) !== Math.round(currentWidth))
        win.style.width = `${Math.round(newWidth)}px`;
      this.saveWindowSize();
    }
  }

  showConfirm(message, onConfirm) {
    if (!sharedConfirmDialog.dialog) sharedConfirmDialog.create();
    sharedConfirmDialog.show(message, onConfirm);
  }

  handleExport() {
    const dataStr = JSON.stringify(this.presets, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = this.config.exportFileName;
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  }

  handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const imported = JSON.parse(text);
        if (
          Array.isArray(imported) &&
          imported.every(
            (p) => typeof p === "object" && "name" in p && "value" in p
          )
        ) {
          const existingNames = new Set(
            this.presets.map((p) => p.name.toLowerCase())
          );
          let added = 0;
          imported.reverse().forEach((pNew) => {
            if (
              typeof pNew.name === "string" &&
              typeof pNew.value === "string" &&
              !existingNames.has(pNew.name.toLowerCase())
            ) {
              this.presets.unshift({
                name: pNew.name.trim(),
                value: pNew.value.trim(),
              });
              existingNames.add(pNew.name.toLowerCase());
              added++;
            }
          });
          this.savePresets();
          this.renderPresetList();
          if (window.location.hostname.includes("udio.com")) {
            UdioIntegration.refreshIntegratedUI();
          }
          alert(`Imported ${added} new presets for ${this.config.uiTitle}.`);
        } else {
          alert("Invalid file format.");
        }
      } catch (err) {
        alert("Error reading file: " + err.message);
        logger.error("Import failed:", err);
      }
    };
    input.click();
  }

  deleteAllPresets() {
    this.showConfirm(
      `Are you sure you want to delete ALL ${this.presets.length} presets for '${this.config.uiTitle}'? This action cannot be undone.`,
      () => {
        if (this.editingPresetIndex !== null) this.cancelEditPreset();
        this.presets = [];
        this.managerCurrentPage = 1;
        this.savePresets();
        this.renderPresetList();
        if (window.location.hostname.includes("udio.com")) {
          UdioIntegration.refreshIntegratedUI();
        }
        alert("All presets deleted.");
      }
    );
  }

  async loadDefaultPresets() {
    if (!this.config.defaultPresetsUrl) {
      alert("No default presets URL configured for this manager.");
      return;
    }
    try {
      const localUrl = chrome.runtime.getURL(this.config.defaultPresetsUrl);
      const response = await fetch(localUrl);
      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status} ${response.statusText}`
        );
      }
      const defaultData = await response.json();
      if (
        !Array.isArray(defaultData) ||
        !defaultData.every(
          (p) =>
            typeof p === "object" &&
            "name" in p &&
            typeof p.name === "string" &&
            "value" in p &&
            typeof p.value === "string"
        )
      ) {
        alert("Invalid default presets data structure from URL.");
        return;
      }

      const existingNames = new Set(
        this.presets.map((p) => p.name.toLowerCase())
      );
      let addedCount = 0;
      let skippedCount = 0;
      defaultData.reverse().forEach((pDefault) => {
        const trimmedName = pDefault.name.trim();
        const trimmedValue = pDefault.value.trim();
        if (trimmedName && !existingNames.has(trimmedName.toLowerCase())) {
          this.presets.unshift({ name: trimmedName, value: trimmedValue });
          existingNames.add(trimmedName.toLowerCase());
          addedCount++;
        } else {
          skippedCount++;
        }
      });

      if (addedCount > 0) this.savePresets();
      this.renderPresetList();
      if (window.location.hostname.includes("udio.com")) {
        UdioIntegration.refreshIntegratedUI();
      }
      alert(
        `Added ${addedCount} new default presets for ${this.config.uiTitle}. ${skippedCount} duplicates were skipped.`
      );
    } catch (error) {
      alert(`Failed to process default presets: ${error.message}`);
      logger.error(
        `Failed to load/process defaults for ${this.config.id}:`,
        error
      );
    }
  }
}
