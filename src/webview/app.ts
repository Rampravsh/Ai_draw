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
  TextLevel,
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

  // Sidebar Elements
  private inspectorSidebar: HTMLElement;
  private colorSwatches: HTMLElement;
  private workspaceSelect: HTMLSelectElement;
  private workspacePathHint: HTMLElement;
  private btnBrowseWorkspace: HTMLElement;
  private btnShowCreatePlan: HTMLElement;
  private inlineCreateBox: HTMLElement;
  private newPlanInput: HTMLInputElement;
  private btnConfirmCreatePlan: HTMLElement;
  private btnCancelCreatePlan: HTMLElement;
  private diagramsList: HTMLElement;

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

    // Sidebar Elements
    this.inspectorSidebar = document.getElementById("inspector-sidebar")!;
    this.colorSwatches = document.getElementById("color-swatches")!;
    this.workspaceSelect = document.getElementById("workspace-select") as HTMLSelectElement;
    this.workspacePathHint = document.getElementById("workspace-path-hint")!;
    this.btnBrowseWorkspace = document.getElementById("btn-browse-workspace")!;
    this.btnShowCreatePlan = document.getElementById("btn-show-create-plan")!;
    this.inlineCreateBox = document.getElementById("inline-create-box")!;
    this.newPlanInput = document.getElementById("new-plan-input") as HTMLInputElement;
    this.btnConfirmCreatePlan = document.getElementById("btn-confirm-create-plan")!;
    this.btnCancelCreatePlan = document.getElementById("btn-cancel-create-plan")!;
    this.diagramsList = document.getElementById("diagrams-list")!;

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

    this.liveCanvas.setOnToolChange((tool) => {
      this.setActiveTool(tool, false);
    });

    this.setupToolbar();
    this.setupSidebar();
    this.setupInlinePlanCreation();
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

    // Project Workspace Dropdown Selector
    this.workspaceSelect?.addEventListener("change", () => {
      const selectedPath = this.workspaceSelect.value;
      if (selectedPath && selectedPath !== this.activeWorkspacePath) {
        this.vscode.postMessage({
          type: "switchWorkspace",
          workspacePath: selectedPath,
        });
        this.showTemporaryStatus("Switching project...");
      }
    });

    // Browse Workspace Folder
    this.btnBrowseWorkspace?.addEventListener("click", () => {
      this.vscode.postMessage({ type: "browseWorkspace" });
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

    // Typography Level Buttons Click (H1, H2, H3, P)
    document.querySelectorAll<HTMLButtonElement>(".level-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const level = btn.getAttribute("data-level") as TextLevel;
        document.querySelectorAll(".level-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        if (this.liveCanvas.selectedNodeId) {
          this.liveCanvas.updateSelectedNode({ textLevel: level });
        }
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
  }

  // Pure Inline Plan Creation (Zero Prompt, Zero Dialog — Works 100% in Webview)
  private setupInlinePlanCreation() {
    this.btnShowCreatePlan?.addEventListener("click", () => {
      const isVisible = this.inlineCreateBox.style.display === "flex";
      this.inlineCreateBox.style.display = isVisible ? "none" : "flex";
      if (!isVisible) {
        this.newPlanInput.value = "";
        this.newPlanInput.focus();
      }
    });

    this.btnCancelCreatePlan?.addEventListener("click", () => {
      this.inlineCreateBox.style.display = "none";
      this.newPlanInput.value = "";
    });

    const submitCreatePlan = () => {
      const val = this.newPlanInput.value.trim();
      if (val.length > 0) {
        this.vscode.postMessage({
          type: "newDiagram",
          title: val,
        });
        this.newPlanInput.value = "";
        this.inlineCreateBox.style.display = "none";
        this.showTemporaryStatus("Creating plan...");
      }
    };

    this.btnConfirmCreatePlan?.addEventListener("click", submitCreatePlan);

    this.newPlanInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitCreatePlan();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.inlineCreateBox.style.display = "none";
        this.newPlanInput.value = "";
      }
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

    // Set matching font and typography level
    const font = node.fontFamily || this.liveCanvas.defaultFont;
    textarea.style.fontFamily =
      font === "handwritten" ? "var(--font-hand)" : "var(--font-ui)";

    const level = node.textLevel || "p";
    const fontSize = level === "h1" ? "24px" : level === "h2" ? "20px" : level === "h3" ? "17px" : "14px";
    textarea.style.fontSize = fontSize;
    textarea.style.lineHeight = level === "h1" ? "30px" : level === "h2" ? "25px" : level === "h3" ? "22px" : "19px";
    textarea.style.fontWeight = level === "p" ? "500" : "700";

    if (node.textColor) {
      textarea.style.color = node.textColor;
    } else {
      const isDark = this.liveCanvas.theme === "dark";
      const colors = (this.liveCanvas as any).resolveColor(node.color || "default", isDark);
      if (node.type === "text" && node.color && node.color !== "default" && colors) {
        textarea.style.color = colors.border;
      } else {
        textarea.style.color = isDark ? "#f4f4f5" : "#18181b";
      }
    }

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
      document.querySelectorAll(".level-btn").forEach((b) => b.classList.remove("active"));
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

    // Update typography level button (H1, H2, H3, P)
    const level = node.textLevel || "p";
    document.querySelectorAll(".level-btn").forEach((b) => {
      if (b.getAttribute("data-level") === level) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });
  }

  public setActiveTool(tool: ToolMode, syncCanvas: boolean = true) {
    if (syncCanvas) {
      this.liveCanvas.setTool(tool);
    }
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

      // Delete selected node or edge
      if (e.key === "Delete" || e.key === "Backspace") {
        if (this.liveCanvas.deleteSelected()) {
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
        case "t":
          this.setActiveTool("text");
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

    // 1. Populate Workspace Selector Dropdown in Sidebar
    if (this.workspaceSelect) {
      this.workspaceSelect.innerHTML = "";
      workspaces.forEach((ws) => {
        const opt = document.createElement("option");
        opt.value = ws.path;
        opt.textContent = `${ws.name} (${ws.diagramCount} plan${ws.diagramCount === 1 ? "" : "s"})`;
        if (ws.path === activeWs.path || ws.isCurrent) {
          opt.selected = true;
        }
        this.workspaceSelect.appendChild(opt);
      });
    }

    // 2. Update Workspace Path Display
    if (this.workspacePathHint) {
      this.workspacePathHint.textContent = activeWs.path || "No folder open";
      this.workspacePathHint.title = activeWs.path || "";
    }

    // 3. Render Diagrams List in Sidebar
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
          <span>${d.nodeCount} node${d.nodeCount === 1 ? "" : "s"}</span>
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

      // 2-Step Inline Safe Delete (Zero Window.confirm popup block!)
      const delBtn = document.createElement("button");
      delBtn.className = "diagram-delete-btn";
      delBtn.innerHTML = "✕";
      delBtn.title = `Delete ${d.filename}`;

      let confirmTimer: number | null = null;
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!delBtn.classList.contains("confirming")) {
          // First click: Request confirmation
          delBtn.classList.add("confirming");
          delBtn.textContent = "Delete?";
          confirmTimer = window.setTimeout(() => {
            delBtn.classList.remove("confirming");
            delBtn.textContent = "✕";
            confirmTimer = null;
          }, 4000);
        } else {
          // Second click: Confirmed delete!
          if (confirmTimer) clearTimeout(confirmTimer);
          delBtn.classList.remove("confirming");
          this.vscode.postMessage({
            type: "deleteDiagram",
            filename: d.filename,
          });
          this.showTemporaryStatus(`Deleted ${d.filename}`);
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
