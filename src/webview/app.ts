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
  private diagramsList: HTMLElement;

  // Inline Direct Text Editor Elements
  private inlineEditorContainer: HTMLElement;
  private inlineEditorTextarea: HTMLTextAreaElement;
  private activeEditingNodeId: string | null = null;

  // State
  private activeDiagramName: string = "plan.json";

  constructor() {
    const canvasElement = document.getElementById("canvas") as HTMLCanvasElement;
    this.toolbar = document.getElementById("toolbar")!;
    this.btnShowToolbar = document.getElementById("btn-show-toolbar")!;
    this.statusDot = document.getElementById("status-dot")!;
    this.statusText = document.getElementById("status-text")!;

    this.inspectorSidebar = document.getElementById("inspector-sidebar")!;
    this.colorSwatches = document.getElementById("color-swatches")!;
    this.diagramsList = document.getElementById("diagrams-list")!;

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

    // Font Toggle: applies to selected node OR board
    const fontBtn = document.getElementById("btn-font-toggle");
    fontBtn?.addEventListener("click", () => {
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
      });
    });

    // Shape Palette Click:
    // If a node is currently selected on canvas -> MORPH that node's shape!
    // If NO node is selected -> create a new shape at center!
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

    // Color Swatches Click -> morph selected node color
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

    // Status Buttons Click -> morph selected node status
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

    // Font Buttons Click -> morph selected node font
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

    // Duplicate & Delete
    document.getElementById("btn-duplicate-node")?.addEventListener("click", () => {
      this.liveCanvas.duplicateSelectedNode();
    });

    document.getElementById("btn-delete-node")?.addEventListener("click", () => {
      this.liveCanvas.deleteSelectedNode();
      this.showTemporaryStatus("Deleted (Ctrl+Z to Undo)");
    });

    // New Diagram File
    document.getElementById("btn-new-file")?.addEventListener("click", () => {
      const title = prompt("Enter a name for the new diagram:", "New Architecture");
      if (title && title.trim().length > 0) {
        this.vscode.postMessage({
          type: "newDiagram",
          title: title.trim(),
        });
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
    const fullContent = node.text && node.text.trim().length > 0
      ? `${node.title}\n${node.text}`
      : node.title;

    textarea.value = fullContent;
    textarea.style.fontFamily =
      (node.fontFamily || this.liveCanvas.defaultFont) === "sans"
        ? "'Inter', sans-serif"
        : "'Shantell Sans', 'Patrick Hand', cursive, sans-serif";

    container.style.display = "flex";
    container.style.left = `${Math.max(10, screenRect.x)}px`;
    container.style.top = `${Math.max(10, screenRect.y)}px`;
    container.style.width = `${Math.max(160, screenRect.w)}px`;
    container.style.height = `${Math.max(70, screenRect.h)}px`;

    textarea.focus();
    // Select all text for fast editing
    textarea.select();
  }

  private closeInlineEditor() {
    if (this.activeEditingNodeId) {
      this.activeEditingNodeId = null;
      this.inlineEditorContainer.style.display = "none";
      this.liveCanvas.render();
    }
  }

  private updateSidebarSelection(node: CanvasNode | null) {
    if (!node) {
      this.colorSwatches.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
      document.querySelectorAll(".status-btn").forEach((b) => b.classList.remove("active"));
      return;
    }

    // Update active swatch
    this.colorSwatches.querySelectorAll(".swatch").forEach((s) => {
      if (s.getAttribute("data-color") === (node.color || "default")) {
        s.classList.add("active");
      } else {
        s.classList.remove("active");
      }
    });

    // Update active status
    document.querySelectorAll(".status-btn").forEach((b) => {
      if (b.getAttribute("data-status") === (node.status || "none")) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });

    // Update active font
    document.querySelectorAll(".font-btn").forEach((b) => {
      if (b.getAttribute("data-font") === (node.fontFamily || this.liveCanvas.defaultFont)) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });
  }

  private setActiveTool(tool: ToolMode) {
    this.liveCanvas.currentTool = tool;
    document.querySelectorAll("[data-tool]").forEach((btn) => {
      if (btn.getAttribute("data-tool") === tool) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    const c = this.liveCanvas.canvas;
    if (tool === "pan") c.style.cursor = "grab";
    else if (tool === "eraser") c.style.cursor = "crosshair";
    else c.style.cursor = "default";
  }

  public setFont(font: FontFamily) {
    this.liveCanvas.defaultFont = font;
    const label = document.getElementById("font-label");
    if (label) {
      label.textContent = font === "handwritten" ? "✍ Shantell" : "Clean Sans";
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
            this.liveCanvas.loadPlan(msg.plan, false);
            if (msg.plan.theme) this.setTheme(msg.plan.theme);
            if (msg.plan.grid) this.setGrid(msg.plan.grid);
            if (msg.plan.fontFamily) this.setFont(msg.plan.fontFamily);
            if (msg.plan.filename) this.activeDiagramName = msg.plan.filename;
            this.updateZoomDisplay();
          }
          break;
        case "diagramListUpdate":
          if (msg.diagrams) {
            this.renderDiagramsList(msg.diagrams, msg.activeDiagram || this.activeDiagramName);
          }
          break;
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

  private renderDiagramsList(files: string[], active: string) {
    this.diagramsList.innerHTML = "";
    files.forEach((file) => {
      const item = document.createElement("div");
      item.className = `diagram-item ${file === active ? "active" : ""}`;

      const nameSpan = document.createElement("span");
      nameSpan.className = "diagram-name";
      nameSpan.textContent = file.replace(/\.json$/, "");
      nameSpan.title = file;

      nameSpan.addEventListener("click", () => {
        this.vscode.postMessage({
          type: "switchDiagram",
          filename: file,
        });
      });

      const delBtn = document.createElement("button");
      delBtn.className = "diagram-delete-btn";
      delBtn.innerHTML = "✕";
      delBtn.title = "Delete this diagram";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Delete diagram "${file}"? This action cannot be undone.`)) {
          this.vscode.postMessage({
            type: "deleteDiagram",
            filename: file,
          });
        }
      });

      item.appendChild(nameSpan);
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
