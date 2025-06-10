// js/modules/ui/lyricVaultManager.js

import { Logger } from "@/modules/logger.js";
import { USPM_UI_PREFIX, ICONS, MANAGER_CONFIGS } from "@/modules/config.js";
import {
  createIcon,
  applyReactControlledInputPreset,
  debounce,
} from "@/modules/utils.js";
import { sharedConfirmDialog } from "./sharedDialog.js";
import { idb } from "../idb.js";

const ULVM_UI_PREFIX = "ulvm";
const logger = new Logger("LyricVaultManager");

export class LyricVaultManager {
  constructor() {
    this.config = MANAGER_CONFIGS.lyricVault;
    this.items = []; // Holds lyrics and folders
    this.openFolders = new Set();
    this.ui = {
      managerWindow: null,
      lyricList: null,
      displayPane: null,
      titleInput: null,
      contentInput: null,
      resizeHandle: null,
      applySelectionBtn: null,
      // **NEW**: Search UI elements
      searchInput: null,
      searchContentToggle: null,
    };
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.isResizing = false;
    this.resizeStartX = 0;
    this.resizeStartY = 0;
    this.resizeStartWidth = 0;
    this.resizeStartHeight = 0;
    this.editingItemId = null;
    this.selectedItemId = null;
    this.dragState = {};
    this.isCreatingFolder = false;
    // **NEW**: Search state
    this.searchTerm = "";
    this.isSearchingContent = false;
    this.debouncedSearch = debounce(this.renderTree.bind(this), 300);
  }

  async loadItems() {
    try {
      let stored = await idb.get(this.config.storageKey);
      if (Array.isArray(stored)) {
        const needsMigration = stored.some((item) => !item.type);
        if (needsMigration) {
          logger.log("Migrating old lyric data structure...");
          stored = stored.map((item) => ({
            id: item.id || `${Date.now()}-${Math.random()}`,
            parentId: null,
            type: "item",
            name: item.name,
            value: item.value,
            createdAt: item.createdAt || Date.now(),
            updatedAt: item.updatedAt || Date.now(),
          }));
        }
        this.items = stored;
      } else {
        this.items = [];
      }
    } catch (e) {
      this.items = [];
      logger.error("Failed to load lyrics from IndexedDB:", e);
    }
  }

  async saveItems() {
    try {
      await idb.put(this.config.storageKey, this.items);
    } catch (e) {
      logger.error("Failed to save lyrics to IndexedDB:", e);
    }
  }

  createManagerWindow() {
    if (document.getElementById(`${ULVM_UI_PREFIX}-window`)) return;

    const win = document.createElement("div");
    win.id = `${ULVM_UI_PREFIX}-window`;
    win.className = `${USPM_UI_PREFIX}-window ${ULVM_UI_PREFIX}-window`;
    win.style.display = "none";
    win.style.width = "900px";
    win.style.height = "700px";

    const header = this.createHeader();
    win.appendChild(header);

    const mainContent = document.createElement("div");
    mainContent.className = `${ULVM_UI_PREFIX}-main-content`;
    win.appendChild(mainContent);

    const listPane = document.createElement("div");
    listPane.className = `${ULVM_UI_PREFIX}-list-pane`;

    // **NEW**: Add search controls
    const searchControls = this.createSearchControls();
    listPane.appendChild(searchControls);

    this.ui.lyricList = document.createElement("div");
    this.ui.lyricList.className = `${ULVM_UI_PREFIX}-lyric-list`;
    listPane.appendChild(this.ui.lyricList);
    mainContent.appendChild(listPane);

    this.ui.displayPane = document.createElement("div");
    this.ui.displayPane.className = `${ULVM_UI_PREFIX}-display-pane`;
    mainContent.appendChild(this.ui.displayPane);

    const footer = this.createFooter();
    win.appendChild(footer);

    document.body.appendChild(win);
    this.ui.managerWindow = win;
    this.makeDraggable(header, win);
    this.makeResizable(this.ui.resizeHandle, win);

    this.loadWindowPosition();
    this.loadWindowSize();
    this.ensureWindowInViewport();

    document.addEventListener(
      "selectionchange",
      this.handleSelectionChange.bind(this)
    );

    this.renderTree();
  }

  // **NEW**: Method to create search UI
  createSearchControls() {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.gap = "8px";
    container.style.marginBottom = "8px";
    container.style.alignItems = "center";

    this.ui.searchInput = document.createElement("input");
    this.ui.searchInput.type = "text";
    this.ui.searchInput.placeholder = "Search lyrics...";
    this.ui.searchInput.className = `${USPM_UI_PREFIX}-input`;
    this.ui.searchInput.style.flexGrow = "1";
    this.ui.searchInput.oninput = (e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.debouncedSearch();
    };
    container.appendChild(this.ui.searchInput);

    const toggleLabel = document.createElement("label");
    toggleLabel.textContent = "Content";
    toggleLabel.style.fontSize = "0.8em";
    toggleLabel.style.display = "flex";
    toggleLabel.style.alignItems = "center";
    toggleLabel.style.cursor = "pointer";

    this.ui.searchContentToggle = document.createElement("input");
    this.ui.searchContentToggle.type = "checkbox";
    this.ui.searchContentToggle.style.marginLeft = "4px";
    this.ui.searchContentToggle.onchange = (e) => {
      this.isSearchingContent = e.target.checked;
      this.renderTree();
    };

    toggleLabel.prepend(this.ui.searchContentToggle);
    container.appendChild(toggleLabel);

    return container;
  }

  createHeader() {
    const header = document.createElement("div");
    header.className = `${USPM_UI_PREFIX}-header`;
    header.appendChild(
      createIcon(ICONS.drag_handle, `${USPM_UI_PREFIX}-drag-handle-icon`)
    );
    const title = document.createElement("span");
    title.className = `${USPM_UI_PREFIX}-header-title`;
    title.textContent = this.config.uiTitle;
    header.appendChild(title);
    const headerControls = document.createElement("div");
    headerControls.className = `${USPM_UI_PREFIX}-header-controls`;
    headerControls.appendChild(
      this.createHeaderButton(ICONS.close, "Close", () =>
        this.toggleManagerWindow()
      )
    );
    header.appendChild(headerControls);
    return header;
  }

  createFooter() {
    const footer = document.createElement("div");
    footer.className = `${USPM_UI_PREFIX}-footer`;
    footer.appendChild(
      this.createFooterButton(ICONS.add, "Add Lyric", () =>
        this.startEditing(null, "item")
      )
    );
    footer.appendChild(
      this.createFooterButton(ICONS.add_folder, "New Folder", () =>
        this.addNewFolder()
      )
    );
    footer.appendChild(
      this.createFooterButton(ICONS.sort_alpha, "Sort A-Z", () =>
        this.sortAll()
      )
    );
    footer.appendChild(
      this.createFooterButton(ICONS.upload, "Import", () => this.handleImport())
    );
    footer.appendChild(
      this.createFooterButton(ICONS.download, "Export", () =>
        this.handleExport()
      )
    );
    footer.appendChild(
      this.createFooterButton(
        ICONS.delete_forever,
        "Delete All",
        () => this.deleteAllItems(),
        `${USPM_UI_PREFIX}-footer-btn-danger`
      )
    );
    this.ui.resizeHandle = document.createElement("div");
    this.ui.resizeHandle.className = `${USPM_UI_PREFIX}-resize-handle`;
    this.ui.resizeHandle.innerHTML = "⇲";
    footer.appendChild(this.ui.resizeHandle);
    return footer;
  }

  renderTree() {
    if (!this.ui.lyricList) return;
    this.ui.lyricList.innerHTML = "";

    let filteredItems = this.items;
    let parentIdsToShow = new Set();

    if (this.searchTerm) {
      const matchingItems = this.items.filter((item) => {
        const titleMatch = item.name.toLowerCase().includes(this.searchTerm);
        const contentMatch =
          this.isSearchingContent &&
          item.type === "item" &&
          item.value &&
          item.value.toLowerCase().includes(this.searchTerm);
        return titleMatch || contentMatch;
      });

      matchingItems.forEach((item) => {
        parentIdsToShow.add(item.id);
        let current = item;
        while (current.parentId) {
          parentIdsToShow.add(current.parentId);
          current = this.items.find((p) => p.id === current.parentId);
        }
      });

      filteredItems = this.items.filter((item) => parentIdsToShow.has(item.id));
    }

    const rootItems = filteredItems.filter((item) => item.parentId === null);
    this.buildTreeLevel(
      rootItems,
      this.ui.lyricList,
      0,
      filteredItems,
      this.searchTerm !== ""
    );

    if (filteredItems.length === 0) {
      this.ui.lyricList.innerHTML = `<p class="${ULVM_UI_PREFIX}-no-lyrics">${
        this.searchTerm ? "No results found." : "No lyrics or folders."
      }</p>`;
    }

    if (
      this.selectedItemId &&
      !filteredItems.find((i) => i.id === this.selectedItemId)
    ) {
      this.selectedItemId = null;
    }

    if (!this.selectedItemId && filteredItems.length > 0) {
      this.selectedItemId =
        filteredItems.find((i) => i.type === "item")?.id || filteredItems[0].id;
    }

    this.renderDisplayPane();
  }

  buildTreeLevel(
    itemsInLevel,
    parentElement,
    depth,
    fullFilteredList,
    isSearching
  ) {
    itemsInLevel.forEach((item) => {
      const itemContainer = document.createElement("div");
      itemContainer.className = `${ULVM_UI_PREFIX}-tree-item`;
      itemContainer.dataset.id = item.id;

      const itemSelf = document.createElement("div");
      itemSelf.className = `${ULVM_UI_PREFIX}-tree-item-self`;
      itemSelf.style.paddingLeft = `${8 + depth * 20}px`;
      itemSelf.dataset.id = item.id;
      itemSelf.draggable = !isSearching; // Disable drag during search
      if (item.id === this.selectedItemId) {
        itemSelf.classList.add("selected");
      }

      const isFolderOpen = this.openFolders.has(item.id) || isSearching; // Auto-open folders during search

      if (item.type === "folder") {
        itemSelf.classList.add("is-folder");
        if (isFolderOpen) itemSelf.classList.add("open");
        itemSelf.appendChild(
          createIcon(isFolderOpen ? ICONS.folder_open : ICONS.folder)
        );
      } else {
        itemSelf.appendChild(createIcon(ICONS.lyrics));
      }
      itemSelf.appendChild(document.createTextNode(` ${item.name}`));
      itemSelf.onclick = (e) => {
        e.stopPropagation();
        this.handleItemClick(item.id);
      };

      if (!isSearching) {
        itemSelf.ondragstart = (e) => this.handleDragStart(e, item.id);
        itemSelf.ondragover = (e) => this.handleDragOver(e);
        itemSelf.ondragleave = (e) => this.handleDragLeave(e);
        itemSelf.ondrop = (e) => this.handleDrop(e);
      }

      itemContainer.appendChild(itemSelf);

      if (item.type === "folder" && isFolderOpen) {
        const childrenContainer = document.createElement("div");
        childrenContainer.className = `${ULVM_UI_PREFIX}-tree-item-children`;
        itemContainer.appendChild(childrenContainer);
        const children = fullFilteredList.filter((i) => i.parentId === item.id);
        this.buildTreeLevel(
          children,
          childrenContainer,
          depth + 1,
          fullFilteredList,
          isSearching
        );
      }
      parentElement.appendChild(itemContainer);
    });
  }

  renderDisplayPane() {
    if (!this.ui.displayPane) return;
    this.ui.displayPane.innerHTML = "";

    if (this.editingItemId === "new") {
      this.renderEditView({ name: "", value: "" });
      return;
    }

    const item = this.items.find((i) => i.id === this.selectedItemId);

    if (!item) {
      this.ui.displayPane.innerHTML = `<div class="${ULVM_UI_PREFIX}-display-placeholder">Select a lyric or folder.</div>`;
      return;
    }

    if (this.editingItemId === item.id) {
      this.renderEditView(item);
    } else {
      this.renderReadView(item);
    }
  }

  renderReadView(item) {
    const isUdioContext = !!this.config.targetInputSelector();

    if (item.type === "folder") {
      this.ui.displayPane.innerHTML = `<div class="${ULVM_UI_PREFIX}-display-placeholder">Folder: ${item.name}</div>`;
      return;
    }

    const title = document.createElement("h3");
    title.className = `${ULVM_UI_PREFIX}-display-title`;
    title.textContent = item.name;

    const content = document.createElement("div");
    content.className = `${ULVM_UI_PREFIX}-display-content`;
    content.textContent = item.value;

    const meta = document.createElement("div");
    meta.className = `${ULVM_UI_PREFIX}-display-meta`;
    meta.innerHTML = `<span>Created: ${new Date(
      item.createdAt
    ).toLocaleString()}</span><span>Updated: ${new Date(
      item.updatedAt
    ).toLocaleString()}</span>`;

    const controls = document.createElement("div");
    controls.className = `${ULVM_UI_PREFIX}-display-controls`;

    if (isUdioContext) {
      this.ui.applySelectionBtn = this.createDisplayButton(
        ICONS.apply_selection,
        "Apply Selection",
        () => this.applyLyric(null, true),
        `${ULVM_UI_PREFIX}-apply-selection-btn`
      );
      this.ui.applySelectionBtn.style.display = "none";
      controls.appendChild(this.ui.applySelectionBtn);

      controls.appendChild(
        this.createDisplayButton(ICONS.apply, "Apply", () =>
          this.applyLyric(item.value)
        )
      );
    } else {
      this.ui.applySelectionBtn = this.createDisplayButton(
        ICONS.copy,
        "Copy Selection",
        (e) => this.copyLyric(e, null, true),
        `${ULVM_UI_PREFIX}-apply-selection-btn`
      );
      this.ui.applySelectionBtn.style.display = "none";
      controls.appendChild(this.ui.applySelectionBtn);

      controls.appendChild(
        this.createDisplayButton(ICONS.copy, "Copy", (e) =>
          this.copyLyric(e, item.value)
        )
      );
    }

    controls.appendChild(
      this.createDisplayButton(ICONS.edit, "Edit", () =>
        this.startEditing(item.id, "item")
      )
    );
    controls.appendChild(
      this.createDisplayButton(
        ICONS.delete,
        "Delete",
        () => this.deleteItem(item.id),
        `${USPM_UI_PREFIX}-footer-btn-danger`
      )
    );

    this.ui.displayPane.appendChild(title);
    this.ui.displayPane.appendChild(content);
    this.ui.displayPane.appendChild(meta);
    this.ui.displayPane.appendChild(controls);
  }

  renderEditView(item) {
    const isAdding = !item.id;
    const itemType = isAdding ? this.editingType : item.type;

    this.ui.titleInput = document.createElement("input");
    this.ui.titleInput.type = "text";
    this.ui.titleInput.className = `${ULVM_UI_PREFIX}-display-title-input ${USPM_UI_PREFIX}-input`;
    this.ui.titleInput.value = item.name || "";

    this.ui.displayPane.appendChild(this.ui.titleInput);

    if (itemType === "item") {
      this.ui.contentInput = document.createElement("textarea");
      this.ui.contentInput.className = `${ULVM_UI_PREFIX}-display-content-input ${USPM_UI_PREFIX}-input`;
      this.ui.contentInput.value = item.value || "";
      this.ui.displayPane.appendChild(this.ui.contentInput);
    }

    const controls = document.createElement("div");
    controls.className = `${ULVM_UI_PREFIX}-display-controls`;
    controls.appendChild(
      this.createDisplayButton(ICONS.save, "Save", () =>
        this.saveItem(itemType)
      )
    );
    controls.appendChild(
      this.createDisplayButton(
        ICONS.cancel,
        "Cancel",
        () => this.endEditing(),
        "secondary"
      )
    );

    this.ui.displayPane.appendChild(controls);
    this.ui.titleInput.focus();
  }

  createHeaderButton(icon, title, onClickHandler) {
    const btn = document.createElement("button");
    btn.className = `${USPM_UI_PREFIX}-icon-button`;
    btn.title = title;
    btn.appendChild(createIcon(icon));
    btn.onclick = onClickHandler;
    return btn;
  }
  createFooterButton(icon, title, onClickHandler, extraClass = "") {
    const btn = document.createElement("button");
    btn.className = `${USPM_UI_PREFIX}-text-button secondary ${extraClass}`;
    btn.title = title;
    btn.appendChild(createIcon(icon));
    btn.appendChild(document.createTextNode(` ${title}`));
    btn.onclick = onClickHandler;
    return btn;
  }
  createDisplayButton(icon, title, onClickHandler, extraClass = "") {
    const btn = document.createElement("button");
    btn.className = `${USPM_UI_PREFIX}-text-button ${extraClass}`;
    btn.title = title;
    btn.appendChild(createIcon(icon));
    btn.appendChild(document.createTextNode(` ${title}`));
    btn.onclick = onClickHandler;
    return btn;
  }
  makeDraggable(dragHandle, elementToDrag) {
    dragHandle.onmousedown = (e) => {
      e.preventDefault();
      this.isDragging = true;
      this.dragOffsetX = e.clientX - elementToDrag.offsetLeft;
      this.dragOffsetY = e.clientY - elementToDrag.offsetTop;
      document.onmousemove = (ev) => this.dragElement(ev);
      document.onmouseup = () => this.stopDrag();
    };
  }
  dragElement(e) {
    if (!this.isDragging || !this.ui.managerWindow) return;
    this.ui.managerWindow.style.left = e.clientX - this.dragOffsetX + "px";
    this.ui.managerWindow.style.top = e.clientY - this.dragOffsetY + "px";
  }
  stopDrag() {
    this.isDragging = false;
    document.onmouseup = null;
    document.onmousemove = null;
    this.saveWindowPosition();
    this.ensureWindowInViewport();
  }
  makeResizable(resizeHandle, elementToResize) {
    resizeHandle.onmousedown = (e) => {
      e.preventDefault();
      this.isResizing = true;
      this.resizeStartX = e.clientX;
      this.resizeStartY = e.clientY;
      this.resizeStartWidth = elementToResize.offsetWidth;
      this.resizeStartHeight = elementToResize.offsetHeight;
      document.onmousemove = (ev) => this.resizeElement(ev);
      document.onmouseup = () => this.stopResize();
    };
  }
  resizeElement(e) {
    if (!this.isResizing || !this.ui.managerWindow) return;
    const cs = document.defaultView.getComputedStyle(this.ui.managerWindow);
    const minWidth = parseInt(cs.minWidth, 10) || 500;
    const minHeight = parseInt(cs.minHeight, 10) || 400;

    const newWidth = this.resizeStartWidth + (e.clientX - this.resizeStartX);
    const newHeight = this.resizeStartHeight + (e.clientY - this.resizeStartY);

    this.ui.managerWindow.style.width = `${Math.max(minWidth, newWidth)}px`;
    this.ui.managerWindow.style.height = `${Math.max(minHeight, newHeight)}px`;
  }
  stopResize() {
    this.isResizing = false;
    document.onmousemove = null;
    document.onmouseup = null;
    this.saveWindowSize();
    this.ensureWindowInViewport();
  }

  handleItemClick(itemId) {
    const item = this.items.find((i) => i.id === itemId);
    if (!item) return;
    if (this.editingItemId) this.endEditing();
    if (item.type === "folder") {
      if (this.openFolders.has(itemId)) this.openFolders.delete(itemId);
      else this.openFolders.add(itemId);
    }
    this.selectedItemId = itemId;
    this.renderTree();
  }

  startEditing(itemId, type) {
    this.editingItemId = itemId || "new";
    this.editingType = type;
    if (this.editingItemId === "new") {
      this.selectedItemId = null;
    }
    this.renderDisplayPane();
  }

  endEditing() {
    this.editingItemId = null;
    this.renderTree();
  }

  saveItem(type) {
    const name = this.ui.titleInput.value.trim();
    if (!name) {
      alert("Title cannot be empty.");
      return;
    }
    const now = Date.now();
    if (this.editingItemId === "new") {
      const parentFolder = this.items.find(
        (i) => i.id === this.selectedItemId && i.type === "folder"
      );
      const newItem = {
        id: `${now}-${Math.random()}`,
        parentId: parentFolder ? parentFolder.id : null,
        type,
        name,
        value: type === "item" ? this.ui.contentInput.value : null,
        createdAt: now,
        updatedAt: now,
      };
      this.items.push(newItem);
      this.selectedItemId = newItem.id;
    } else {
      const item = this.items.find((i) => i.id === this.editingItemId);
      if (item) {
        item.name = name;
        item.updatedAt = now;
        if (item.type === "item") item.value = this.ui.contentInput.value;
      }
    }
    this.saveItems();
    this.editingItemId = null;
    this.renderTree();
  }

  addNewFolder() {
    if (this.isCreatingFolder) return;
    this.isCreatingFolder = true;
    const placeholderItem = document.createElement("div");
    placeholderItem.className = `${ULVM_UI_PREFIX}-tree-item-self ${ULVM_UI_PREFIX}-new-folder-input-container`;
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "New Folder Name";
    input.className = `${USPM_UI_PREFIX}-input`;
    const handleCreate = () => {
      const name = input.value.trim();
      if (name) {
        const now = Date.now();
        const parentFolder = this.items.find(
          (i) => i.id === this.selectedItemId && i.type === "folder"
        );
        this.items.push({
          id: `${now}-${Math.random()}`,
          parentId: parentFolder ? parentFolder.id : null,
          type: "folder",
          name,
          value: null,
          createdAt: now,
          updatedAt: now,
        });
        this.saveItems();
      }
      this.isCreatingFolder = false;
      this.renderTree();
    };
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCreate();
      } else if (e.key === "Escape") {
        this.isCreatingFolder = false;
        this.renderTree();
      }
    };
    input.onblur = () => {
      if (this.isCreatingFolder) handleCreate();
    };
    placeholderItem.appendChild(createIcon(ICONS.folder));
    placeholderItem.appendChild(input);
    this.ui.lyricList.prepend(placeholderItem);
    input.focus();
  }

  deleteItem(itemId) {
    const item = this.items.find((i) => i.id === itemId);
    if (!item) return;
    sharedConfirmDialog.show(`Delete "${item.name}"?`, () => {
      let idsToDelete = [itemId];
      if (item.type === "folder") {
        const getChildIdsRecursive = (parentId) => {
          this.items
            .filter((i) => i.parentId === parentId)
            .forEach((child) => {
              idsToDelete.push(child.id);
              if (child.type === "folder") getChildIdsRecursive(child.id);
            });
        };
        getChildIdsRecursive(itemId);
      }
      this.items = this.items.filter((i) => !idsToDelete.includes(i.id));
      if (idsToDelete.includes(this.selectedItemId)) this.selectedItemId = null;
      this.saveItems();
      this.renderTree();
    });
  }

  deleteAllItems() {
    sharedConfirmDialog.show(
      `Delete ALL ${this.items.length} lyrics and folders?`,
      () => {
        this.items = [];
        this.selectedItemId = null;
        this.saveItems();
        this.renderTree();
      }
    );
  }

  sortAll() {
    const itemSorter = (a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    };

    const buildHierarchy = (parentId) => {
      const children = this.items
        .filter((item) => item.parentId === parentId)
        .sort(itemSorter);

      return children.flatMap((child) => [child, ...buildHierarchy(child.id)]);
    };

    this.items = buildHierarchy(null);
    this.saveItems();
    this.renderTree();
  }

  getItemDepth(itemId) {
    let depth = 0;
    let currentItem = this.items.find((i) => i.id === itemId);
    while (currentItem && currentItem.parentId) {
      depth++;
      currentItem = this.items.find((i) => i.id === currentItem.parentId);
    }
    return depth;
  }

  handleDragStart(e, itemId) {
    e.stopPropagation();
    this.dragState.draggedId = itemId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", itemId);
    setTimeout(() => e.target.classList.add("dragging"), 0);
  }

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    this.clearDragIndicators();

    const targetEl = e.target.closest(`.${ULVM_UI_PREFIX}-tree-item`);
    if (!targetEl) return;

    const targetId = targetEl.dataset.id;
    if (this.dragState.draggedId === targetId) return;

    const targetItem = this.items.find((i) => i.id === targetId);
    const draggedItem = this.items.find(
      (i) => i.id === this.dragState.draggedId
    );
    if (!targetItem || !draggedItem) return;

    const rect = targetEl.getBoundingClientRect();
    const clientYInTarget = e.clientY - rect.top;

    if (
      targetItem.type === "folder" &&
      clientYInTarget > rect.height * 0.25 &&
      clientYInTarget < rect.height * 0.75
    ) {
      const targetDepth = this.getItemDepth(targetId);
      if (draggedItem.type === "folder" && targetDepth >= 1) return;
      targetEl.classList.add("drag-over-folder");
      this.dragState.dropMode = "into";
    } else {
      this.dragState.dropMode =
        clientYInTarget < rect.height / 2 ? "before" : "after";
      targetEl.classList.add(
        this.dragState.dropMode === "before"
          ? "drag-over-before"
          : "drag-over-after"
      );
    }
    this.dragState.dropTargetId = targetId;
  }

  clearDragIndicators() {
    document
      .querySelectorAll(
        ".drag-over-before, .drag-over-after, .drag-over-folder"
      )
      .forEach((el) =>
        el.classList.remove(
          "drag-over-before",
          "drag-over-after",
          "drag-over-folder"
        )
      );
  }

  handleDragLeave(e) {
    const listPane = e.target.closest(`.${ULVM_UI_PREFIX}-list-pane`);
    if (!listPane || (e.relatedTarget && listPane.contains(e.relatedTarget))) {
      return;
    }
    this.clearDragIndicators();
  }

  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const { draggedId, dropTargetId, dropMode } = this.dragState;
    this.resetDragState();
    if (!draggedId || !dropTargetId || !dropMode) return;

    const draggedItem = this.items.find((i) => i.id === draggedId);
    const dropTargetItem = this.items.find((i) => i.id === dropTargetId);
    if (!draggedItem || !dropTargetItem) return;

    const fromIndex = this.items.findIndex((i) => i.id === draggedId);
    const [itemToMove] = this.items.splice(fromIndex, 1);

    let toIndex = this.items.findIndex((i) => i.id === dropTargetId);

    if (dropMode === "into") {
      itemToMove.parentId = dropTargetId;
      this.items.push(itemToMove);
    } else {
      itemToMove.parentId = dropTargetItem.parentId;
      if (dropMode === "after") toIndex += 1;
      this.items.splice(toIndex, 0, itemToMove);
    }

    itemToMove.updatedAt = Date.now();
    this.saveItems();
    this.renderTree();
  }

  resetDragState() {
    this.clearDragIndicators();
    const draggedEl = this.ui.managerWindow?.querySelector(".dragging");
    if (draggedEl) draggedEl.classList.remove("dragging");
    this.dragState = {};
  }

  async toggleManagerWindow() {
    if (!this.ui.managerWindow) {
      this.createManagerWindow();
      await this.loadItems();
      this.renderTree();
    }
    const win = this.ui.managerWindow;
    const isVisible = win.style.display !== "none";
    win.style.display = isVisible ? "none" : "flex";
    if (!isVisible) {
      this.ensureWindowInViewport();
    }
  }

  async toggleManagerAndSelectLast() {
    const isVisible =
      this.ui.managerWindow && this.ui.managerWindow.style.display !== "none";
    if (!isVisible) {
      await this.toggleManagerWindow();
    }
    const data = await chrome.storage.local.get(
      this.config.lastAppliedStorageKey
    );
    const lastAppliedId = data[this.config.lastAppliedStorageKey];
    if (lastAppliedId && this.items.find((i) => i.id === lastAppliedId)) {
      this.selectedItemId = lastAppliedId;
      this.renderTree();
    }
  }

  async applyLyric(value, isSelection = false) {
    const target = this.config.targetInputSelector();
    if (!target) {
      alert("Could not find the custom lyrics editor on the page.");
      return;
    }

    let textToApply = value;
    if (isSelection) {
      const selection = document.getSelection();
      if (selection && selection.toString().trim()) {
        textToApply = selection.toString();
      } else {
        return;
      }
    }

    applyReactControlledInputPreset(
      target,
      textToApply,
      this.config.id,
      logger
    );

    await chrome.storage.local.set({
      [this.config.lastAppliedStorageKey]: this.selectedItemId,
    });
    this.toggleManagerWindow();
  }

  async copyLyric(event, value, isSelection = false) {
    const button = event.currentTarget;
    if (!button) return;

    let textToCopy = value;
    if (isSelection) {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        textToCopy = selection.toString();
      } else {
        return;
      }
    }

    if (textToCopy === null || textToCopy === undefined) return;

    try {
      await navigator.clipboard.writeText(textToCopy);

      const originalContent = button.innerHTML;
      button.classList.add(`${USPM_UI_PREFIX}-copied-transient`);
      button.innerHTML = `${createIcon(ICONS.confirm).outerHTML} Copied!`;
      setTimeout(() => {
        button.classList.remove(`${USPM_UI_PREFIX}-copied-transient`);
        button.innerHTML = originalContent;
      }, 1500);
    } catch (err) {
      logger.error("Failed to copy lyrics:", err);
      alert("Failed to copy lyrics to clipboard.");
    }
  }

  handleSelectionChange() {
    if (!this.ui.applySelectionBtn) return;
    const selection = document.getSelection();
    const displayContent = this.ui.displayPane.querySelector(
      `.${ULVM_UI_PREFIX}-display-content`
    );
    if (
      displayContent &&
      selection.anchorNode &&
      displayContent.contains(selection.anchorNode)
    ) {
      const hasSelection =
        !selection.isCollapsed && selection.toString().trim().length > 0;
      this.ui.applySelectionBtn.style.display = hasSelection
        ? "inline-flex"
        : "none";
    } else {
      this.ui.applySelectionBtn.style.display = "none";
    }
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

  async saveWindowSize() {
    if (!this.ui.managerWindow) return;
    const size = {
      width: this.ui.managerWindow.style.width,
      height: this.ui.managerWindow.style.height,
    };
    if (size.width || size.height) {
      await chrome.storage.local.set({
        [this.config.uiSizeStorageKey]: JSON.stringify(size),
      });
    }
  }

  async loadWindowSize() {
    if (!this.ui.managerWindow) return;
    const data = await chrome.storage.local.get(this.config.uiSizeStorageKey);
    const storedSize = data[this.config.uiSizeStorageKey];
    if (storedSize) {
      try {
        const size = JSON.parse(storedSize);
        if (size.width && CSS.supports("width", size.width)) {
          this.ui.managerWindow.style.width = size.width;
        }
        if (size.height && CSS.supports("height", size.height)) {
          this.ui.managerWindow.style.height = size.height;
        }
      } catch (e) {
        logger.warn("Could not parse stored lyric vault size", e);
      }
    }
  }

  setDefaultPosition() {
    if (!this.ui.managerWindow) return;
    const win = this.ui.managerWindow;
    const winWidth = win.offsetWidth;
    const winHeight = win.offsetHeight;

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

    win.style.top = `${Math.round(defaultTop)}px`;
    win.style.left = `${Math.round(defaultLeft)}px`;
  }

  ensureWindowInViewport() {
    if (!this.ui.managerWindow) return;
    const win = this.ui.managerWindow;
    const cs = window.getComputedStyle(win);
    let rect = win.getBoundingClientRect();

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    let newL = rect.left;
    let newT = rect.top;

    if (rect.left < 0) newL = 0;
    if (rect.right > vpW) newL = Math.max(0, vpW - rect.width);
    if (rect.top < 0) newT = 0;
    if (rect.bottom > vpH) newT = Math.max(0, vpH - rect.height);

    if (Math.round(newL) !== rect.left || Math.round(newT) !== rect.top) {
      win.style.left = `${Math.round(newL)}px`;
      win.style.top = `${Math.round(newT)}px`;
      this.saveWindowPosition();
    }
  }

  handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const importedData = JSON.parse(await file.text());
        if (!Array.isArray(importedData))
          throw new Error("Imported data is not an array.");

        const existingIds = new Set(this.items.map((i) => i.id));
        importedData.forEach((item) => {
          if (!existingIds.has(item.id)) {
            this.items.push(item);
          }
        });

        this.saveItems();
        this.renderTree();
        alert(`Lyrics imported successfully.`);
      } catch (err) {
        alert("Import failed: " + err.message);
      }
    };
    input.click();
  }
  handleExport() {
    const dataStr = JSON.stringify(this.items, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = this.config.exportFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }
}
