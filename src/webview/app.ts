import { LiveCanvas, ToolMode } from "./engine/canvas";
import { CanvasExporter } from "./engine/exporter";
import {
  CanvasPlan,
  CanvasNode,
  HostToWebviewMessage,
  WebviewToHostMessage,
  GridMode,
  ThemeMode,
  NodeType,
  FontFamily,
  NodeStatus,
  DiagramFileInfo,
  WorkspaceInfo,
} from "../types";

declare function acquireVsCodeApi(): {
  postMessage: (msg: WebviewToHostMessage) => void;
  getState: () => any;
  setState: (state: any) => void;
};

class WebviewApp {
  private vscode = acquireVsCodeApi();
  private liveCanvas: LiveCanvas;
  private saveDebounceTimer?: number;

  // Header Elements
  private toolbar: HTMLElement;
  private btnShowToolbar: HTMLElement;
  private statusDot: HTMLElement;
  private statusText: HTMLElement;

  // Top Bar Workspace & File Dropdown Elements
  private workspaceFileSelector: HTMLElement;
  private btnFileSelector: HTMLElement;
  private headerWsBadge: HTMLElement;
  private headerFileBadge: HTMLElement;
  private dropdownWorkspacesList: HTMLElement;
  private dropdownDiagramsList: HTMLElement;
  private btnBrowseFolder: HTMLElement;
  private btnQuickNewDiagram: HTMLElement;

  // Sidebar Elements
  private inspectorSidebar: HTMLElement;
  private colorSwatches: HTMLElement;
  private diagramsList: HTMLElement;
  private sidebarWsName: HTMLElement;
  private btnSidebarSwitchWs: HTMLElement;

  // Inline Direct Text Editor Elements
  private inlineEditorContainer: HTMLElement;
  private inlineEditorTextarea: HTMLTextAreaElement;
  private activeEditingNodeId: string | null = null;

  // State
  private activeDiagramName: string = "plan.json";
  private activeWorkspaceName: string = "Workspace";
  private activeWorkspacePath: string = "";
  private diagramDetails: DiagramFileInfo[] = [];
  private availableWorkspaces: WorkspaceInfo[] = [];

  constructor() {
    const canvasElement = document.getElementById("canvas") as HTMLCanvasElement;
    this.toolbar = document.getElementById("toolbar")!;
    this.btnShowToolbar = document.getElementById("btn-show-toolbar")!;
    this.statusDot = document.getElementById("status-dot")!;
    this.statusText = document.getElementById("status-text")!;

    // Dropdown Elements
    this.workspaceFileSelector = document.getElementById("workspace-file-selector")!;
    this.btnFileSelector = document.getElementById("btn-file-selector")!;
    this.headerWsBadge = document.getElementById("header-ws-badge")!;
    this.headerFileBadge = document.getElementById("header-file-badge")!;
    this.dropdownWorkspacesList = document.getElementById("dropdown-workspaces-list")!;
    this.dropdownDiagramsList = document.getElementById("dropdown-diagrams-list")!;
    this.btnBrowseFolder = document.getElementById("btn-browse-folder")!;
    this.btnQuickNewDiagram = document.getElementById("btn-quick-new-diagram")!;

    // Sidebar Elements
    this.inspectorSidebar = document.getElementById("inspector-sidebar")!;
    this.colorSwatches = document.getElementById("color-swatches")!;
    this.diagramsList = document.getElementById("diagrams-list")!;
    this.sidebarWsName = document.getElementById("sidebar-ws-name")!;
    this.btnSidebarSwitchWs = document.getElementById("btn-sidebar-switch-ws")!;

    // Inline Editor
    this.inlineEditorContainer = document.getElementById("inline-text-editor-container")!;
    this.inlineEditorTextarea = document.getElementById("inline-text-editor") as HTMLTextAreaElement;

    this.liveCanvas = new LiveCanvas(
      canvasElement,
      (updatedPlan) => {
        this.handleUserEdit(updatedPlan);
      },
      (selectedNode) => {
        this.updateSidebarSelection(selectedNode);
      },
      (node, screenRect) => {
        this.openInlineEditor(node, screenRect);
      }
    );

    this.setupToolbar();
    this.setupWorkspaceDropdown();
    this.setupSidebar();
    this.setupInlineEditor();
    this.setupDragAndDrop();
    this.setupKeyboardShortcuts();
    this.setupIpc();

    // Initial sync
    this.vscode.postMessage({ type: "requestSync" });
    this.vscode.postMessage({ type: "listDiagrams" });

    window.addEventListener("resize", () => {
      this.liveCanvas.resize();
      this.closeInlineEditor();
    });
  }

  private setupToolbar() {
    document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tool = btn.getAttribute("data-tool") as ToolMode;
        this.setActiveTool(tool);
      });
    });

    // Undo / Redo
    document.getElementById("btn-undo")?.addEventListener("click", () => {
      if (this.liveCanvas.undo()) {
        this.showTemporaryStatus("Undone");
      }
    });

    document.getElementById("btn-redo")?.addEventListener("click", () => {
      if (this.liveCanvas.redo()) {
        this.showTemporaryStatus("Redone");
      }
    });

    // Zoom
    document.getElementById("btn-zoom-in")?.addEventListener("click", () => {
      this.liveCanvas.zoomIn();
      this.updateZoomDisplay();
    });

    document.getElementById("btn-zoom-out")?.addEventListener("click", () => {
      this.liveCanvas.zoomOut();
      this.updateZoomDisplay();
    });

    document.getElementById("btn-fit")?.addEventListener("click", () => {
      this.liveCanvas.fitToContent();
      this.updateZoomDisplay();
    });

    // Font Toggle
    const fontToggleBtn = document.getElementById("btn-font-toggle");
    fontToggleBtn?.addEventListener("click", () => {
      const nextFont: FontFamily =
        this.liveCanvas.defaultFont === "handwritten" ? "sans" : "handwritten";
      this.setFont(nextFont);

      // If a node is selected, morph that node's font too!
      if (this.liveCanvas.selectedNodeId) {
        this.liveCanvas.updateSelectedNode({ fontFamily: nextFont });
      }
    });

    // Grid Toggle
    const gridBtn = document.getElementById("btn-grid");
    gridBtn?.addEventListener("click", () => {
      const modes: GridMode[] = ["graph", "dots", "blank"];
      const nextIdx = (modes.indexOf(this.liveCanvas.grid) + 1) % modes.length;
      this.setGrid(modes[nextIdx]);
    });

    // Theme Toggle
    const themeBtn = document.getElementById("btn-theme");
    themeBtn?.addEventListener("click", () => {
      const nextTheme: ThemeMode = this.liveCanvas.theme === "dark" ? "light" : "dark";
      this.setTheme(nextTheme);
    });

    // Export PNG
    document.getElementById("btn-export")?.addEventListener("click", () => {
      CanvasExporter.exportToPng(this.liveCanvas, "ai-plan.png");
    });

    // Collapsible Toolbar
    const hideToolbarBtn = document.getElementById("btn-hide-toolbar");
    hideToolbarBtn?.addEventListener("click", () => {
      this.toolbar.classList.add("hidden");
      this.btnShowToolbar.classList.add("visible");
      this.liveCanvas.resize();
    });

    this.btnShowToolbar.addEventListener("click", () => {
      this.toolbar.classList.remove("hidden");
      this.btnShowToolbar.classList.remove("visible");
      this.liveCanvas.resize();
    });

    // Toggle Sidebar
    const toggleSidebarBtn = document.getElementById("btn-toggle-sidebar");
    toggleSidebarBtn?.addEventListener("click", () => {
      this.inspectorSidebar.classList.toggle("collapsed");
      toggleSidebarBtn.classList.toggle("active");
      this.liveCanvas.resize();
    });
  }

  private setupWorkspaceDropdown() {
    this.btnFileSelector?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.workspaceFileSelector.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
      if (!this.workspaceFileSelector.contains(e.target as Node)) {
        this.closeDropdown();
      }
    });

    this.btnBrowseFolder?.addEventListener("click", () => {
      this.closeDropdown();
      this.vscode.postMessage({ type: "browseWorkspace" });
    });

    this.btnQuickNewDiagram?.addEventListener("click", () => {
      this.closeDropdown();
      this.promptAndCreateNewDiagram();
    });

    this.btnSidebarSwitchWs?.addEventListener("click", () => {
      this.vscode.postMessage({ type: "browseWorkspace" });
    });
  }

  private closeDropdown() {
    this.workspaceFileSelector.classList.remove("open");
  }

  private promptAndCreateNewDiagram() {
    const title = prompt("Enter a name for the new plan (e.g. Backend Architecture, User Flow):", "");
    if (title && title.trim().length > 0) {
      this.vscode.postMessage({
        type: "newDiagram",
        title: title.trim(),
      });
      this.showTemporaryStatus("Creating plan...");
    }
  }

  private setupSidebar() {
    // Tabs
    const tabBtns = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const tabName = btn.getAttribute("data-tab");
        document.querySelectorAll(".tab-pane").forEach((pane) => {
          pane.classList.remove("active");
        });
        document.getElementById(`tab-${tabName}`)?.classList.add("active");

        // If switching to files tab, refresh diagram list
        if (tabName === "files") {
          this.vscode.postMessage({ type: "listDiagrams" });
        }
      });
    });

    // Shape Palette Click
    document.querySelectorAll<HTMLButtonElement>("[data-shape]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const shapeType = btn.getAttribute("data-shape") as NodeType;

        if (this.liveCanvas.selectedNodeId) {
          // Morph selected node
          this.liveCanvas.updateSelectedNode({ type: shapeType });
          this.showTemporaryStatus(`Morphed to ${shapeType}`);
        } else {
          // Add new node at center
          const cx = this.liveCanvas.canvas.clientWidth / 2;
          const cy = this.liveCanvas.canvas.clientHeight / 2;
          const world = this.liveCanvas.screenToWorld(cx, cy);
          this.liveCanvas.createNodeAt(shapeType, world.x, world.y);
          this.liveCanvas.render();
        }
      });
    });

    // Color Swatches Click
    this.colorSwatches.querySelectorAll<HTMLButtonElement>(".swatch").forEach((swatch) => {
      swatch.addEventListener("click", () => {
        const color = swatch.getAttribute("data-color") || "default";
        this.colorSwatches.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
        swatch.classList.add("active");
        if (this.liveCanvas.selectedNodeId) {
          this.liveCanvas.updateSelectedNode({ color });
        }
      });
    });

    // Status Buttons Click
    document.querySelectorAll<HTMLButtonElement>(".status-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const status = btn.getAttribute("data-status") as NodeStatus;
        document.querySelectorAll(".status-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        if (this.liveCanvas.selectedNodeId) {
          this.liveCanvas.updateSelectedNode({ status });
        }
      });
    });

    // Font Buttons Click
    document.querySelectorAll<HTMLButtonElement>(".font-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const font = btn.getAttribute("data-font") as FontFamily;
        document.querySelectorAll(".font-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        if (this.liveCanvas.selectedNodeId) {
          this.liveCanvas.updateSelectedNode({ fontFamily: font });
        }
        this.setFont(font);
      });
    });

    // Duplicate & Delete Node
    document.getElementById("btn-duplicate-node")?.addEventListener("click", () => {
      this.liveCanvas.duplicateSelectedNode();
    });

    document.getElementById("btn-delete-node")?.addEventListener("click", () => {
      this.liveCanvas.deleteSelectedNode();
      this.showTemporaryStatus("Deleted (Ctrl+Z to Undo)");
    });

    // New Diagram File from sidebar
    document.getElementById("btn-new-file")?.addEventListener("click", () => {
      this.promptAndCreateNewDiagram();
    });
  }

  // HTML5 Drag & Drop from Sidebar onto Canvas
  private setupDragAndDrop() {
    const canvas = this.liveCanvas.canvas;

    document.querySelectorAll<HTMLButtonElement>(".shape-card").forEach((btn) => {
      btn.addEventListener("dragstart", (e) => {
        const shapeType = btn.getAttribute("data-shape") || "card";
        e.dataTransfer?.setData("text/plain", shapeType);
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "copy";
        }
      });
    });

    canvas.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    });

    canvas.addEventListener("drop", (e) => {
      e.preventDefault();
      const shapeType = e.dataTransfer?.getData("text/plain") as NodeType;
      if (!shapeType) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.liveCanvas.screenToWorld(sx, sy);

      this.liveCanvas.createNodeAt(shapeType, world.x, world.y);
      this.liveCanvas.render();
      this.showTemporaryStatus(`Added ${shapeType}`);
    });
  }

  // Pure In-Place Direct Inline Text Editor
  private setupInlineEditor() {
    const textarea = this.inlineEditorTextarea;

    textarea.addEventListener("input", () => {
      if (!this.activeEditingNodeId) return;
      const val = textarea.value;
      const lines = val.split("\n");
      const title = lines[0] || "";
      const text = lines.slice(1).join("\n");

      this.liveCanvas.updateSelectedNode({ title, text });
    });

    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.closeInlineEditor();
      }
    });

    textarea.addEventListener("blur", () => {
      this.closeInlineEditor();
    });
  }

  private openInlineEditor(
    node: CanvasNode,
    screenRect: { x: number; y: number; w: number; h: number }
  ) {
    this.activeEditingNodeId = node.id;
    const container = this.inlineEditorContainer;
    const textarea = this.inlineEditorTextarea;

    // Combine title and description
    let fullText = node.title || "";
    if (node.text) {
      fullText = fullText ? `${fullText}\n${node.text}` : node.text;
    }
    textarea.value = fullText;

    // Position textarea directly over the node
    const pad = 4;
    container.style.left = `${screenRect.x - pad}px`;
    container.style.top = `${screenRect.y - pad}px`;
    container.style.width = `${Math.max(screenRect.w + pad * 2, 140)}px`;
    container.style.height = `${Math.max(screenRect.h + pad * 2, 80)}px`;
    container.style.display = "flex";

    // Set matching font
    const font = node.fontFamily || this.liveCanvas.defaultFont;
    textarea.style.fontFamily =
      font === "handwritten" ? "var(--font-hand)" : "var(--font-ui)";

    textarea.focus();
    textarea.select();
  }

  private closeInlineEditor() {
    if (!this.activeEditingNodeId) return;
    this.activeEditingNodeId = null;
    this.inlineEditorContainer.style.display = "none";
    this.liveCanvas.render();
  }

  private updateSidebarSelection(node: CanvasNode | null) {
    if (!node) {
      this.colorSwatches.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
      document.querySelectorAll(".status-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".font-btn").forEach((b) => b.classList.remove("active"));
      return;
    }

    // Update color swatch
    const color = node.color || "default";
    this.colorSwatches.querySelectorAll(".swatch").forEach((s) => {
      if (s.getAttribute("data-color") === color) {
        s.classList.add("active");
      } else {
        s.classList.remove("active");
      }
    });

    // Update status button
    const status = node.status || "none";
    document.querySelectorAll(".status-btn").forEach((b) => {
      if (b.getAttribute("data-status") === status) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });

    // Update font button
    const font = node.fontFamily || this.liveCanvas.defaultFont;
    document.querySelectorAll(".font-btn").forEach((b) => {
      if (b.getAttribute("data-font") === font) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });
  }

  public setActiveTool(tool: ToolMode) {
    this.liveCanvas.toolMode = tool;
    document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((btn) => {
      if (btn.getAttribute("data-tool") === tool) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  public setFont(font: FontFamily) {
    this.liveCanvas.defaultFont = font;
    const fontLabel = document.getElementById("font-label");
    if (fontLabel) {
      fontLabel.textContent = font === "handwritten" ? "✍ Shantell" : "Clean Sans";
    }
    this.liveCanvas.render();
  }

  public setTheme(theme: ThemeMode) {
    this.liveCanvas.theme = theme;
    const body = document.body;
    if (theme === "dark") {
      body.classList.remove("theme-light");
      body.classList.add("theme-dark");
      const btn = document.getElementById("btn-theme");
      if (btn) btn.innerHTML = `🌙 <span class="label">Dark</span>`;
    } else {
      body.classList.remove("theme-dark");
      body.classList.add("theme-light");
      const btn = document.getElementById("btn-theme");
      if (btn) btn.innerHTML = `☀️ <span class="label">Light</span>`;
    }
    this.liveCanvas.render();
  }

  public setGrid(grid: GridMode) {
    this.liveCanvas.grid = grid;
    const btn = document.getElementById("btn-grid");
    if (btn) {
      const labels: Record<GridMode, string> = {
        graph: "▦ Graph",
        dots: "⁝ Dots",
        blank: "◻ Blank",
      };
      btn.innerHTML = `<span class="label">${labels[grid]}</span>`;
    }
    this.liveCanvas.render();
  }

  private updateZoomDisplay() {
    const zoomText = document.getElementById("zoom-level");
    if (zoomText) {
      zoomText.textContent = `${Math.round(this.liveCanvas.zoom * 100)}%`;
    }
  }

  private setupKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          this.liveCanvas.redo();
        } else {
          this.liveCanvas.undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        this.liveCanvas.redo();
        return;
      }

      // Delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        if (this.liveCanvas.selectedNodeId) {
          this.liveCanvas.deleteSelectedNode();
          this.showTemporaryStatus("Deleted (Ctrl+Z to Undo)");
        }
      }

      switch (e.key.toLowerCase()) {
        case "v":
          this.setActiveTool("select");
          break;
        case "h":
          this.setActiveTool("pan");
          break;
        case "a":
          this.setActiveTool("arrow");
          break;
        case "e":
          this.setActiveTool("eraser");
          break;
        case "0":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.liveCanvas.resetZoom();
            this.updateZoomDisplay();
          }
          break;
      }
    });
  }

  private setupIpc() {
    window.addEventListener("message", (event) => {
      const msg: HostToWebviewMessage = event.data;
      switch (msg.type) {
        case "syncPlan":
          if (msg.plan) {
            this.showLiveSyncPulse();
            const isDifferentFile =
              Boolean(msg.plan.filename) && msg.plan.filename !== this.activeDiagramName;
            if (msg.plan.filename) {
              this.activeDiagramName = msg.plan.filename;
              this.headerFileBadge.textContent = `📄 ${this.activeDiagramName}`;
            }

            this.liveCanvas.loadPlan(msg.plan, isDifferentFile);
            if (msg.plan.theme) this.setTheme(msg.plan.theme);
            if (msg.plan.grid) this.setGrid(msg.plan.grid);
            if (msg.plan.fontFamily) this.setFont(msg.plan.fontFamily);
            this.updateZoomDisplay();
          }
          break;

        case "diagramListUpdate": {
          const files = msg.diagrams || [];
          const details =
            msg.diagramDetails ||
            files.map((f) => ({
              filename: f,
              title: f.replace(/\.json$/, "").replace(/-/g, " "),
              nodeCount: 0,
            }));
          const workspaces = msg.workspaces || [];
          const activeWs =
            msg.activeWorkspace || {
              name: this.activeWorkspaceName,
              path: this.activeWorkspacePath,
              isCurrent: true,
              diagramCount: files.length,
            };
          const activeDiag = msg.activeDiagram || this.activeDiagramName;

          this.updateWorkspacesAndDiagrams(
            files,
            details,
            workspaces,
            activeWs,
            activeDiag
          );
          break;
        }

        case "setTheme":
          if (msg.theme) this.setTheme(msg.theme);
          break;
        case "setGrid":
          if (msg.grid) this.setGrid(msg.grid);
          break;
        case "triggerExport":
          CanvasExporter.exportToPng(this.liveCanvas);
          break;
        case "clear":
          this.liveCanvas.loadPlan({
            title: "AI Live Plan",
            nodes: [],
            edges: [],
          });
          break;
      }
    });
  }

  private updateWorkspacesAndDiagrams(
    files: string[],
    details: DiagramFileInfo[],
    workspaces: WorkspaceInfo[],
    activeWs: WorkspaceInfo,
    activeDiagram: string
  ) {
    this.activeDiagramName = activeDiagram;
    this.activeWorkspaceName = activeWs.name;
    this.activeWorkspacePath = activeWs.path;
    this.diagramDetails = details;
    this.availableWorkspaces = workspaces;

    // Update Header Badges
    this.headerWsBadge.textContent = `📁 ${activeWs.name}`;
    this.headerFileBadge.textContent = `📄 ${activeDiagram}`;
    this.sidebarWsName.textContent = activeWs.name;

    // 1. Render Dropdown Workspaces List
    this.dropdownWorkspacesList.innerHTML = "";
    workspaces.forEach((ws) => {
      const item = document.createElement("div");
      item.className = `dropdown-item ${ws.isCurrent ? "active" : ""}`;
      item.title = ws.path;

      const main = document.createElement("div");
      main.className = "dropdown-item-main";
      main.innerHTML = `<span style="color:#38bdf8;">📁</span> <span class="dropdown-item-name">${ws.name}</span>`;

      const badge = document.createElement("span");
      badge.className = "dropdown-item-badge";
      badge.textContent = `${ws.diagramCount} plan${ws.diagramCount === 1 ? "" : "s"}`;

      item.appendChild(main);
      item.appendChild(badge);

      item.addEventListener("click", () => {
        this.closeDropdown();
        if (!ws.isCurrent) {
          this.vscode.postMessage({
            type: "switchWorkspace",
            workspacePath: ws.path,
          });
          this.showTemporaryStatus(`Switching to ${ws.name}...`);
        }
      });

      this.dropdownWorkspacesList.appendChild(item);
    });

    // 2. Render Dropdown Diagrams List
    this.dropdownDiagramsList.innerHTML = "";
    details.forEach((d) => {
      const item = document.createElement("div");
      const isActive = d.filename === activeDiagram;
      item.className = `dropdown-item ${isActive ? "active" : ""}`;

      const main = document.createElement("div");
      main.className = "dropdown-item-main";
      main.innerHTML = `<span>📄</span> <span class="dropdown-item-name" title="${d.filename}">${d.title}</span>`;

      const badge = document.createElement("span");
      badge.className = "dropdown-item-badge";
      badge.textContent = `${d.nodeCount} node${d.nodeCount === 1 ? "" : "s"}`;

      const delBtn = document.createElement("button");
      delBtn.className = "dropdown-item-del";
      delBtn.innerHTML = "✕";
      delBtn.title = `Delete ${d.filename}`;
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Delete diagram "${d.title}" (${d.filename})? This action cannot be undone.`)) {
          this.vscode.postMessage({
            type: "deleteDiagram",
            filename: d.filename,
          });
        }
      });

      main.addEventListener("click", () => {
        this.closeDropdown();
        if (!isActive) {
          this.vscode.postMessage({
            type: "switchDiagram",
            filename: d.filename,
          });
          this.showTemporaryStatus(`Loading ${d.title}...`);
        }
      });

      item.appendChild(main);
      item.appendChild(badge);
      item.appendChild(delBtn);
      this.dropdownDiagramsList.appendChild(item);
    });

    // 3. Render Sidebar Diagrams Tab List
    this.diagramsList.innerHTML = "";
    details.forEach((d) => {
      const item = document.createElement("div");
      const isActive = d.filename === activeDiagram;
      item.className = `diagram-item ${isActive ? "active" : ""}`;

      const info = document.createElement("div");
      info.className = "diagram-item-info";
      info.innerHTML = `
        <div class="diagram-name">${d.title}</div>
        <div class="diagram-subtext">
          <span>📄 ${d.filename}</span>
          <span>•</span>
          <span>${d.nodeCount} nodes</span>
        </div>
      `;

      info.addEventListener("click", () => {
        if (!isActive) {
          this.vscode.postMessage({
            type: "switchDiagram",
            filename: d.filename,
          });
          this.showTemporaryStatus(`Loading ${d.title}...`);
        }
      });

      const delBtn = document.createElement("button");
      delBtn.className = "diagram-delete-btn";
      delBtn.innerHTML = "✕";
      delBtn.title = `Delete ${d.filename}`;
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Delete diagram "${d.title}" (${d.filename})? This action cannot be undone.`)) {
          this.vscode.postMessage({
            type: "deleteDiagram",
            filename: d.filename,
          });
        }
      });

      item.appendChild(info);
      item.appendChild(delBtn);
      this.diagramsList.appendChild(item);
    });
  }

  private showLiveSyncPulse() {
    this.statusDot.classList.add("pulse");
    this.statusText.textContent = "AI Live Sync...";
    setTimeout(() => {
      this.statusDot.classList.remove("pulse");
      this.statusText.textContent = "AI Live";
    }, 1200);
  }

  private showTemporaryStatus(text: string) {
    this.statusText.textContent = text;
    setTimeout(() => {
      this.statusText.textContent = "AI Live";
    }, 1500);
  }

  private handleUserEdit(updatedPlan: CanvasPlan) {
    if (this.saveDebounceTimer) {
      window.clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = window.setTimeout(() => {
      this.vscode.postMessage({
        type: "savePlan",
        filename: this.activeDiagramName,
        plan: updatedPlan,
      });

      this.vscode.postMessage({
        type: "logActivity",
        activity: {
          action: "user_edited_canvas",
          details: `User modified canvas (${updatedPlan.nodes.length} nodes)`,
          timestamp: new Date().toISOString(),
        },
      });
    }, 350);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new WebviewApp();
});
