// js/modules/ui/launcher.js

import { Logger } from "@/modules/logger.js";
import { USPM_UI_PREFIX, ICONS } from "@/modules/config.js";
import { createIcon } from "@/modules/utils.js";
import { UdioPromptGeneratorIntegrated } from "./promptGeneratorUI.js";

const LAUNCHER_UI_PREFIX = "usm-launcher";
const logger = new Logger("Launcher");

export class Launcher {
  constructor(promptManager, styleReductionManager, lyricVaultManager) {
    this.promptManager = promptManager;
    this.styleReductionManager = styleReductionManager;
    this.lyricVaultManager = lyricVaultManager;
    // The prompt generator is a singleton object, not a class instance
    this.promptGenerator = UdioPromptGeneratorIntegrated;
    this.ui = {
      launcherWindow: null,
    };
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
  }

  createLauncherWindow() {
    if (document.getElementById(`${LAUNCHER_UI_PREFIX}-window`)) return;

    this.ui.launcherWindow = document.createElement("div");
    this.ui.launcherWindow.id = `${LAUNCHER_UI_PREFIX}-window`;
    this.ui.launcherWindow.className = `${USPM_UI_PREFIX}-window`;
    this.ui.launcherWindow.style.display = "none";
    this.ui.launcherWindow.style.width = "280px";
    this.ui.launcherWindow.style.minWidth = "280px";
    this.ui.launcherWindow.style.height = "auto";
    this.ui.launcherWindow.style.resize = "none"; // No resize for the simple launcher

    const header = this.createHeader();
    this.ui.launcherWindow.appendChild(header);

    const content = this.createContent();
    this.ui.launcherWindow.appendChild(content);

    document.body.appendChild(this.ui.launcherWindow);
    this.makeDraggable(header, this.ui.launcherWindow);
  }

  createHeader() {
    const header = document.createElement("div");
    header.className = `${USPM_UI_PREFIX}-header`;
    header.appendChild(
      createIcon(ICONS.drag_handle, `${USPM_UI_PREFIX}-drag-handle-icon`)
    );

    const title = document.createElement("span");
    title.className = `${USPM_UI_PREFIX}-header-title`;
    title.textContent = "Udio Smart Manager";
    header.appendChild(title);

    const controls = document.createElement("div");
    controls.className = `${USPM_UI_PREFIX}-header-controls`;
    controls.appendChild(
      this.createHeaderButton(ICONS.close, "Close", () =>
        this.toggleLauncherWindow()
      )
    );
    header.appendChild(controls);

    return header;
  }

  createContent() {
    const content = document.createElement("div");
    content.className = `${LAUNCHER_UI_PREFIX}-content`;
    content.style.padding = "15px";
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.gap = "10px";

    content.appendChild(
      this.createLaunchButton(
        "Prompt Presets",
        this.promptManager.toggleManagerWindow.bind(this.promptManager)
      )
    );
    content.appendChild(
      this.createLaunchButton(
        "Style Reduction Presets",
        this.styleReductionManager.toggleManagerWindow.bind(
          this.styleReductionManager
        )
      )
    );
    content.appendChild(
      this.createLaunchButton(
        "LyricVault",
        this.lyricVaultManager.toggleManagerWindow.bind(this.lyricVaultManager)
      )
    );
    content.appendChild(
      this.createLaunchButton(
        "Advanced Prompt Generator",
        this.promptGenerator.toggleGeneratorWindow.bind(this.promptGenerator)
      )
    );

    return content;
  }

  createLaunchButton(text, onClickHandler) {
    const button = document.createElement("button");
    button.className = `${USPM_UI_PREFIX}-text-button`;
    button.textContent = text;
    button.style.width = "100%";
    button.style.justifyContent = "center";
    button.onclick = (e) => {
      e.preventDefault();
      onClickHandler();
    };
    return button;
  }

  createHeaderButton(icon, title, onClickHandler) {
    const btn = document.createElement("button");
    btn.className = `${USPM_UI_PREFIX}-icon-button`;
    btn.title = title;
    btn.appendChild(createIcon(icon));
    btn.onclick = onClickHandler;
    return btn;
  }

  toggleLauncherWindow() {
    if (!this.ui.launcherWindow) {
      this.createLauncherWindow();
    }
    const win = this.ui.launcherWindow;
    const isVisible = win.style.display !== "none";
    win.style.display = isVisible ? "none" : "flex";
    if (!isVisible) {
      this.setDefaultPosition();
      this.ensureWindowInViewport();
    }
  }

  setDefaultPosition() {
    if (!this.ui.launcherWindow) return;
    const win = this.ui.launcherWindow;
    const winWidth = win.offsetWidth;
    const winHeight = win.offsetHeight;
    win.style.top = `${Math.max(10, (window.innerHeight - winHeight) / 2)}px`;
    win.style.left = `${Math.max(10, (window.innerWidth - winWidth) / 2)}px`;
  }

  ensureWindowInViewport() {
    if (!this.ui.launcherWindow) return;
    const win = this.ui.launcherWindow;
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
  }

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
  }

  dragElement(e) {
    if (!this.isDragging || !this.ui.launcherWindow) return;
    this.ui.launcherWindow.style.left = `${e.clientX - this.dragOffsetX}px`;
    this.ui.launcherWindow.style.top = `${e.clientY - this.dragOffsetY}px`;
  }

  stopDrag() {
    this.isDragging = false;
    document.onmouseup = null;
    document.onmousemove = null;
    this.ensureWindowInViewport();
  }
}
