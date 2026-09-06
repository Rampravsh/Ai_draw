import {
  CanvasNode,
  CanvasEdge,
  CanvasPlan,
  GridMode,
  ThemeMode,
  NodeType,
  FontFamily,
  ArrowRouting,
} from "../../types";
import { SketchRenderer } from "./sketch";
import { autoLayoutNodes, getArrowEndpoints } from "./layout";

export type ToolMode =
  | "select"
  | "pan"
  | "arrow"
  | "eraser";

type ResizeHandle = "tl" | "tr" | "br" | "bl";

export class LiveCanvas {
  public canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: SketchRenderer;

  // Viewport transformation
  public panX: number = 0;
  public panY: number = 0;
  public zoom: number = 1.0;

  // Theme & Grid
  public theme: ThemeMode = "dark";
  public grid: GridMode = "graph";
  public defaultFont: FontFamily = "handwritten";

  // Data
  public plan: CanvasPlan = {
    title: "AI Live Plan",
    nodes: [],
    edges: [],
  };

  // Undo / Redo History Stacks
  private historyStack: string[] = [];
  private redoStack: string[] = [];

  // Interaction State
  public currentTool: ToolMode = "select";
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  public selectedNodeId: string | null = null;
  private draggingNode: CanvasNode | null = null;
  private nodeDragOffsetX: number = 0;
  private nodeDragOffsetY: number = 0;

  // Resizing State
  private resizingHandle: ResizeHandle | null = null;
  private resizeNodeStartRect: { x: number; y: number; w: number; h: number } | null = null;
  private resizeMouseStartX: number = 0;
  private resizeMouseStartY: number = 0;

  // Selected Edge State (for adjusting arrow length & endpoints)
  public selectedEdgeIndex: number | null = null;
  private edgeDraggingHandle: "start" | "end" | null = null;

  // Arrow creation state (Drag from anywhere to anywhere)
  private isDrawingArrow: boolean = false;
  private arrowDragStart: { x: number; y: number } | null = null;
  private arrowCurrentEnd: { x: number; y: number } | null = null;
  private arrowStartNodeId: string | null = null;
  private hoverTargetNodeId: string | null = null;

  // Eraser Swipe State (Industry-level drag-to-erase)
  private isErasing: boolean = false;
  private eraserTrail: { x: number; y: number }[] = [];
  private hasErasedInCurrentStroke: boolean = false;

  // Animation
  private animOffset: number = 0;
  private animFrameId: number = 0;
  private resizeObserver?: ResizeObserver;

  // Callbacks
  private onPlanChangeCallback?: (plan: CanvasPlan) => void;
  private onSelectionChangeCallback?: (node: CanvasNode | null) => void;
  private onInlineEditTriggerCallback?: (
    node: CanvasNode,
    screenRect: { x: number; y: number; w: number; h: number }
  ) => void;

  constructor(
    canvas: HTMLCanvasElement,
    onPlanChange?: (plan: CanvasPlan) => void,
    onSelectionChange?: (node: CanvasNode | null) => void,
    onInlineEditTrigger?: (
      node: CanvasNode,
      screenRect: { x: number; y: number; w: number; h: number }
    ) => void
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.renderer = new SketchRenderer(this.ctx);
    this.onPlanChangeCallback = onPlanChange;
    this.onSelectionChangeCallback = onSelectionChange;
    this.onInlineEditTriggerCallback = onInlineEditTrigger;

    this.setupEventListeners();
    this.setupResizeObserver();
    this.resize();
    this.startAnimationLoop();
  }

  private setupResizeObserver() {
    const parent = this.canvas.parentElement || this.canvas;
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.resize();
      });
      this.resizeObserver.observe(parent);
    }
  }

  public setOnPlanChange(cb: (plan: CanvasPlan) => void) {
    this.onPlanChangeCallback = cb;
  }

  public setOnSelectionChange(cb: (node: CanvasNode | null) => void) {
    this.onSelectionChangeCallback = cb;
  }

  public setOnInlineEditTrigger(
    cb: (
      node: CanvasNode,
      screenRect: { x: number; y: number; w: number; h: number }
    ) => void
  ) {
    this.onInlineEditTriggerCallback = cb;
  }

  public resize() {
    const dpr = window.devicePixelRatio || 1;
    const parent = this.canvas.parentElement;
    const width = parent ? parent.clientWidth : this.canvas.clientWidth;
    const height = parent ? parent.clientHeight : this.canvas.clientHeight;

    if (width === 0 || height === 0) return;

    const physicalW = Math.floor(width * dpr);
    const physicalH = Math.floor(height * dpr);

    if (this.canvas.width !== physicalW || this.canvas.height !== physicalH) {
      this.canvas.width = physicalW;
      this.canvas.height = physicalH;
    }

    this.render();
  }

  private recordHistory() {
    const serialized = JSON.stringify(this.plan);
    if (
      this.historyStack.length > 0 &&
      this.historyStack[this.historyStack.length - 1] === serialized
    ) {
      return;
    }
    this.historyStack.push(serialized);
    if (this.historyStack.length > 50) {
      this.historyStack.shift();
    }
    this.redoStack = [];
  }

  public undo(): boolean {
    if (this.historyStack.length === 0) return false;
    const currentSerialized = JSON.stringify(this.plan);
    this.redoStack.push(currentSerialized);

    const prevSerialized = this.historyStack.pop()!;
    this.plan = JSON.parse(prevSerialized);

    if (
      this.selectedNodeId &&
      !this.plan.nodes.some((n) => n.id === this.selectedNodeId)
    ) {
      this.setSelectedNodeId(null);
    }
    this.notifyPlanChange(false);
    this.render();
    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) return false;
    const currentSerialized = JSON.stringify(this.plan);
    this.historyStack.push(currentSerialized);

    const nextSerialized = this.redoStack.pop()!;
    this.plan = JSON.parse(nextSerialized);

    this.notifyPlanChange(false);
    this.render();
    return true;
  }

  public loadPlan(newPlan: CanvasPlan, isFirstLoad: boolean = false) {
    if (newPlan.theme) this.theme = newPlan.theme;
    if (newPlan.grid) this.grid = newPlan.grid;
    if (newPlan.fontFamily) this.defaultFont = newPlan.fontFamily;

    let nodes = newPlan.nodes || [];
    const edges = newPlan.edges || [];

    if (
      newPlan.layout === "auto" ||
      (nodes.length > 0 && nodes.every((n) => n.x === 0 && n.y === 0))
    ) {
      nodes = autoLayoutNodes(nodes, edges);
    }

    this.plan = {
      ...newPlan,
      nodes,
      edges,
    };

    if (isFirstLoad && nodes.length > 0) {
      this.fitToContent();
    } else {
      this.render();
    }

    if (this.selectedNodeId) {
      const current = this.plan.nodes.find((n) => n.id === this.selectedNodeId) || null;
      this.notifySelectionChange(current);
    }
  }

  public getPlan(): CanvasPlan {
    return this.plan;
  }

  public get toolMode(): ToolMode {
    return this.currentTool;
  }

  public set toolMode(tool: ToolMode) {
    this.setTool(tool);
  }

  public setTool(tool: ToolMode) {
    this.currentTool = tool;
    if (tool !== "select") {
      this.selectedNodeId = null;
      this.selectedEdgeIndex = null;
      this.notifySelectionChange(null);
    }
    this.updateCursor();
    this.render();
  }

  public updateCursor() {
    const c = this.canvas;
    if (this.currentTool === "pan") {
      c.style.cursor = this.isDragging ? "grabbing" : "grab";
    } else if (this.currentTool === "arrow") {
      c.style.cursor = "crosshair";
    } else if (this.currentTool === "eraser") {
      c.style.cursor = "cell";
    } else {
      c.style.cursor = "default";
    }
  }

  public deleteSelected(): boolean {
    if (this.selectedNodeId) {
      this.deleteSelectedNode();
      return true;
    }
    if (this.selectedEdgeIndex !== null && this.plan.edges && this.plan.edges[this.selectedEdgeIndex]) {
      this.recordHistory();
      this.plan.edges.splice(this.selectedEdgeIndex, 1);
      this.selectedEdgeIndex = null;
      this.notifyPlanChange();
      this.render();
      return true;
    }
    return false;
  }

  public getEdgeEndpoints(edge: CanvasEdge): { x1: number; y1: number; x2: number; y2: number } | null {
    const nodeMap = new Map<string, CanvasNode>();
    for (const n of this.plan.nodes) {
      nodeMap.set(n.id, n);
    }

    const src = edge.from ? nodeMap.get(edge.from) : undefined;
    const tgt = edge.to ? nodeMap.get(edge.to) : undefined;

    if (src && tgt) {
      return getArrowEndpoints(src, tgt);
    } else if (src && typeof edge.endX === "number" && typeof edge.endY === "number") {
      const vTgt: CanvasNode = {
        id: "_v_tgt",
        type: "card",
        x: edge.endX - 4,
        y: edge.endY - 4,
        width: 8,
        height: 8,
        title: "",
      };
      const pts = getArrowEndpoints(src, vTgt);
      return { x1: pts.x1, y1: pts.y1, x2: edge.endX, y2: edge.endY };
    } else if (tgt && typeof edge.startX === "number" && typeof edge.startY === "number") {
      const vSrc: CanvasNode = {
        id: "_v_src",
        type: "card",
        x: edge.startX - 4,
        y: edge.startY - 4,
        width: 8,
        height: 8,
        title: "",
      };
      const pts = getArrowEndpoints(vSrc, tgt);
      return { x1: edge.startX, y1: edge.startY, x2: pts.x2, y2: pts.y2 };
    } else if (
      typeof edge.startX === "number" &&
      typeof edge.startY === "number" &&
      typeof edge.endX === "number" &&
      typeof edge.endY === "number"
    ) {
      return { x1: edge.startX, y1: edge.startY, x2: edge.endX, y2: edge.endY };
    }
    return null;
  }

  public findEdgeAt(wx: number, wy: number, threshold: number = 14): number | null {
    if (!this.plan.edges) return null;
    const hitRadius = threshold / this.zoom;

    for (let i = this.plan.edges.length - 1; i >= 0; i--) {
      const edge = this.plan.edges[i];
      const pts = this.getEdgeEndpoints(edge);
      if (!pts) continue;

      const dist = this.distToSegment(wx, wy, pts.x1, pts.y1, pts.x2, pts.y2);
      if (dist <= hitRadius) {
        return i;
      }
    }
    return null;
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return Math.hypot(px - projX, py - projY);
  }

  public findEdgeHandleAt(edge: CanvasEdge, wx: number, wy: number): "start" | "end" | null {
    const pts = this.getEdgeEndpoints(edge);
    if (!pts) return null;
    const handleHitRadius = 14 / this.zoom;

    if (Math.hypot(wx - pts.x1, wy - pts.y1) <= handleHitRadius) {
      return "start";
    }
    if (Math.hypot(wx - pts.x2, wy - pts.y2) <= handleHitRadius) {
      return "end";
    }
    return null;
  }

  public drawEdgeHandles(x1: number, y1: number, x2: number, y2: number) {
    const ctx = this.ctx;
    ctx.save();
    const handleRadius = Math.max(5, 7 / this.zoom);

    // Start handle (white circle)
    ctx.beginPath();
    ctx.arc(x1, y1, handleRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, 2 / this.zoom);
    ctx.strokeStyle = "#0284c7";
    ctx.stroke();

    // End handle (cyan circle)
    ctx.beginPath();
    ctx.arc(x2, y2, handleRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#38bdf8";
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, 2 / this.zoom);
    ctx.strokeStyle = "#0369a1";
    ctx.stroke();

    ctx.restore();
  }

  private eraseAtPoint(wx: number, wy: number) {
    const eraserRadius = 18 / this.zoom;
    let modified = false;

    // 1. Check if hit any node
    const hitNode = this.findNodeAt(wx, wy);
    if (hitNode) {
      if (!this.hasErasedInCurrentStroke) {
        this.recordHistory();
        this.hasErasedInCurrentStroke = true;
      }
      this.plan.nodes = this.plan.nodes.filter((n) => n.id !== hitNode.id);
      if (this.plan.edges) {
        this.plan.edges = this.plan.edges.filter(
          (edge) => edge.from !== hitNode.id && edge.to !== hitNode.id
        );
      }
      if (this.selectedNodeId === hitNode.id) {
        this.setSelectedNodeId(null);
      }
      modified = true;
    }

    // 2. Check if hit any edge
    const hitEdgeIdx = this.findEdgeAt(wx, wy, eraserRadius);
    if (hitEdgeIdx !== null && this.plan.edges) {
      if (!this.hasErasedInCurrentStroke) {
        this.recordHistory();
        this.hasErasedInCurrentStroke = true;
      }
      this.plan.edges.splice(hitEdgeIdx, 1);
      if (this.selectedEdgeIndex === hitEdgeIdx) {
        this.selectedEdgeIndex = null;
      } else if (this.selectedEdgeIndex !== null && this.selectedEdgeIndex > hitEdgeIdx) {
        this.selectedEdgeIndex--;
      }
      modified = true;
    }

    if (modified) {
      this.notifyPlanChange(false);
      this.render();
    }
  }

  public setSelectedNodeId(id: string | null) {
    this.selectedNodeId = id;
    if (id) {
      this.selectedEdgeIndex = null;
    }
    const node = id ? this.plan.nodes.find((n) => n.id === id) || null : null;
    this.notifySelectionChange(node);
    this.render();
  }

  public getSelectedNode(): CanvasNode | null {
    if (!this.selectedNodeId) return null;
    return this.plan.nodes.find((n) => n.id === this.selectedNodeId) || null;
  }

  public updateSelectedNode(updates: Partial<CanvasNode>) {
    const node = this.getSelectedNode();
    if (!node) return;

    this.recordHistory();
    Object.assign(node, updates);

    this.autoFitNodeHeight(node);

    this.notifyPlanChange();
    this.notifySelectionChange(node);
    this.render();
  }

  private autoFitNodeHeight(node: CanvasNode) {
    const paddingX = 14;
    const maxW = Math.max(50, node.width - paddingX * 2);
    let totalLines = 1;

    if (node.title) {
      totalLines += Math.max(1, Math.ceil((node.title.length * 9) / maxW));
    }
    if (node.text) {
      const paras = node.text.split("\n");
      for (const p of paras) {
        totalLines += Math.max(1, Math.ceil((p.length * 8) / maxW));
      }
    }

    const minH = totalLines * 22 + 40;
    if (node.height < minH) {
      node.height = minH;
    }
  }

  public deleteSelectedNode() {
    if (!this.selectedNodeId) return;
    this.recordHistory();
    const id = this.selectedNodeId;
    this.plan.nodes = this.plan.nodes.filter((n) => n.id !== id);
    if (this.plan.edges) {
      this.plan.edges = this.plan.edges.filter(
        (edge) => edge.from !== id && edge.to !== id
      );
    }
    this.setSelectedNodeId(null);
    this.notifyPlanChange();
    this.render();
  }

  public duplicateSelectedNode() {
    const node = this.getSelectedNode();
    if (!node) return;
    this.recordHistory();

    const newNode: CanvasNode = {
      ...node,
      id: "node-" + Math.random().toString(36).substr(2, 6),
      x: node.x + 30,
      y: node.y + 30,
      title: node.title + " (Copy)",
    };

    this.plan.nodes.push(newNode);
    this.setSelectedNodeId(newNode.id);
    this.notifyPlanChange();
    this.render();
  }

  public screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom,
    };
  }

  public worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: wx * this.zoom + this.panX,
      y: wy * this.zoom + this.panY,
    };
  }

  public setZoom(newZoom: number, focalScreenX?: number, focalScreenY?: number) {
    const clampedZoom = Math.max(0.15, Math.min(4.0, newZoom));
    const fx = focalScreenX ?? this.canvas.clientWidth / 2;
    const fy = focalScreenY ?? this.canvas.clientHeight / 2;

    const worldBefore = this.screenToWorld(fx, fy);
    this.zoom = clampedZoom;
    const worldAfter = this.screenToWorld(fx, fy);

    this.panX += (worldAfter.x - worldBefore.x) * this.zoom;
    this.panY += (worldAfter.y - worldBefore.y) * this.zoom;

    this.render();
  }

  public zoomIn() {
    this.setZoom(this.zoom * 1.25);
  }

  public zoomOut() {
    this.setZoom(this.zoom / 1.25);
  }

  public resetZoom() {
    this.setZoom(1.0);
  }

  public fitToContent() {
    if (this.plan.nodes.length === 0) {
      this.panX = this.canvas.clientWidth / 4;
      this.panY = this.canvas.clientHeight / 4;
      this.zoom = 1.0;
      this.render();
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of this.plan.nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }

    const padding = 80;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;

    const viewW = this.canvas.clientWidth;
    const viewH = this.canvas.clientHeight;

    const scaleX = viewW / contentW;
    const scaleY = viewH / contentH;
    this.zoom = Math.min(1.2, Math.max(0.3, Math.min(scaleX, scaleY)));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this.panX = viewW / 2 - centerX * this.zoom;
    this.panY = viewH / 2 - centerY * this.zoom;

    this.render();
  }

  private drawGrid(width: number, height: number) {
    if (this.grid === "blank") return;

    const ctx = this.ctx;
    const isDark = this.theme === "dark";
    const baseGridSize = 25;
    const scaledGridSize = baseGridSize * this.zoom;
    if (scaledGridSize < 8) return;

    const offsetX = ((this.panX % scaledGridSize) + scaledGridSize) % scaledGridSize;
    const offsetY = ((this.panY % scaledGridSize) + scaledGridSize) % scaledGridSize;

    if (this.grid === "graph") {
      ctx.save();
      // Minor grid lines
      ctx.strokeStyle = isDark
        ? "rgba(255, 255, 255, 0.04)"
        : "rgba(99, 102, 241, 0.07)";
      ctx.lineWidth = 1;

      ctx.beginPath();
      for (let x = offsetX; x < width; x += scaledGridSize) {
        ctx.moveTo(Math.floor(x) + 0.5, 0);
        ctx.lineTo(Math.floor(x) + 0.5, height);
      }
      for (let y = offsetY; y < height; y += scaledGridSize) {
        ctx.moveTo(0, Math.floor(y) + 0.5);
        ctx.lineTo(width, Math.floor(y) + 0.5);
      }
      ctx.stroke();

      // Major grid lines
      const majorScaled = scaledGridSize * 4;
      const majorOffsetX = ((this.panX % majorScaled) + majorScaled) % majorScaled;
      const majorOffsetY = ((this.panY % majorScaled) + majorScaled) % majorScaled;

      ctx.strokeStyle = isDark
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(99, 102, 241, 0.15)";
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      for (let x = majorOffsetX; x < width; x += majorScaled) {
        ctx.moveTo(Math.floor(x) + 0.5, 0);
        ctx.lineTo(Math.floor(x) + 0.5, height);
      }
      for (let y = majorOffsetY; y < height; y += majorScaled) {
        ctx.moveTo(0, Math.floor(y) + 0.5);
        ctx.lineTo(width, Math.floor(y) + 0.5);
      }
      ctx.stroke();
      ctx.restore();
    } else if (this.grid === "dots") {
      ctx.save();
      ctx.fillStyle = isDark
        ? "rgba(255, 255, 255, 0.14)"
        : "rgba(30, 41, 59, 0.2)";

      for (let x = offsetX; x < width; x += scaledGridSize) {
        for (let y = offsetY; y < height; y += scaledGridSize) {
          ctx.fillRect(Math.floor(x) - 0.75, Math.floor(y) - 0.75, 1.5, 1.5);
        }
      }
      ctx.restore();
    }
  }

  // Main Render Routine with Guaranteed Full Physical Clear
  public render() {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const physW = this.canvas.width;
    const physH = this.canvas.height;
    const cssW = this.canvas.clientWidth || physW / dpr;
    const cssH = this.canvas.clientHeight || physH / dpr;

    // 1. GUARANTEED COMPLETE CLEAR:
    // Reset transform to identity and fill the ENTIRE physical canvas buffer.
    // This prevents any smears, trails, or ghost artifacts!
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.theme === "dark" ? "#121215" : "#fbfbfe";
    ctx.fillRect(0, 0, physW, physH);

    // 2. Set DPR transformation for crisp high-DPI rendering
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 3. Draw background grid
    this.drawGrid(cssW, cssH);

    // 4. Draw Canvas Elements with Pan & Zoom
    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    try {
      const isDark = this.theme === "dark";
      const defaultStroke = isDark ? "#e4e4e7" : "#27272a";

      // 4.1 Draw Edges / Arrows
      const nodeMap = new Map<string, CanvasNode>();
      for (const n of this.plan.nodes) {
        nodeMap.set(n.id, n);
      }

      if (this.plan.edges) {
        for (let i = 0; i < this.plan.edges.length; i++) {
          const edge = this.plan.edges[i];
          const pts = this.getEdgeEndpoints(edge);
          if (!pts) continue;

          const isSelected = this.selectedEdgeIndex === i;
          const arrowColor = isSelected
            ? "#38bdf8"
            : edge.color
            ? this.resolveColor(edge.color, isDark).border
            : isDark
            ? "#a1a1aa"
            : "#52525b";

          this.renderer.drawBendableArrow(
            pts.x1,
            pts.y1,
            pts.x2,
            pts.y2,
            edge.label,
            edge.style || "solid",
            edge.routing || "straight",
            arrowColor,
            this.animOffset,
            this.defaultFont,
            {
              strokeWidth: isSelected ? (edge.strokeWidth || 2) + 1.2 : edge.strokeWidth,
              arrowStart: edge.arrowStart || edge.bidirectional,
              arrowEnd: edge.arrowEnd !== false,
            }
          );

          if (isSelected) {
            this.drawEdgeHandles(pts.x1, pts.y1, pts.x2, pts.y2);
          }
        }
      }

      // 4.2 Draw Nodes
      for (const node of this.plan.nodes) {
        this.drawNode(node, isDark, defaultStroke);
      }

      // 4.3 Draw Selection Ring & 4 Corner Resize Handles
      if (this.selectedNodeId) {
        const selected = nodeMap.get(this.selectedNodeId);
        if (selected) {
          this.drawSelectionAndHandles(selected);
        }
      }

      // 4.4 Live Arrow Creation Preview (Drawing from anywhere to anywhere)
      if (this.isDrawingArrow && this.arrowDragStart && this.arrowCurrentEnd) {
        const p1 = this.arrowDragStart;
        const p2 = this.arrowCurrentEnd;

        // Draw live animated arrow
        this.renderer.drawBendableArrow(
          p1.x,
          p1.y,
          p2.x,
          p2.y,
          undefined,
          "animated",
          "straight",
          "#38bdf8",
          this.animOffset,
          this.defaultFont,
          { strokeWidth: 2.5 }
        );

        // Snap highlight on target node
        if (this.hoverTargetNodeId) {
          const hovered = nodeMap.get(this.hoverTargetNodeId);
          if (hovered) {
            ctx.save();
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(hovered.x - 4, hovered.y - 4, hovered.width + 8, hovered.height + 8);
            ctx.restore();
          }
        }

        // Highlight start node
        if (this.arrowStartNodeId) {
          const startNode = nodeMap.get(this.arrowStartNodeId);
          if (startNode) {
            ctx.save();
            ctx.strokeStyle = "#22c55e";
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(startNode.x - 4, startNode.y - 4, startNode.width + 8, startNode.height + 8);
            ctx.restore();
          }
        }
      }

      // 4.5 Live Eraser Swipe Trail
      if (this.isErasing && this.eraserTrail.length > 1) {
        ctx.save();
        ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
        ctx.lineWidth = Math.max(14, 22 / this.zoom);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(this.eraserTrail[0].x, this.eraserTrail[0].y);
        for (let i = 1; i < this.eraserTrail.length; i++) {
          ctx.lineTo(this.eraserTrail[i].x, this.eraserTrail[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }
    } finally {
      ctx.restore();
    }
  }

  private drawSelectionAndHandles(node: CanvasNode) {
    const ctx = this.ctx;
    ctx.save();

    // Blue dashed bounding box
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(node.x - 4, node.y - 4, node.width + 8, node.height + 8);

    // 4 Corner Square Resize Handles
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 1.8;

    const handleSize = 8 / this.zoom;
    const half = handleSize / 2;

    const corners = [
      { x: node.x - 4, y: node.y - 4 },                          // Top-Left
      { x: node.x + node.width + 4, y: node.y - 4 },             // Top-Right
      { x: node.x + node.width + 4, y: node.y + node.height + 4 },// Bottom-Right
      { x: node.x - 4, y: node.y + node.height + 4 },            // Bottom-Left
    ];

    for (const c of corners) {
      ctx.fillRect(c.x - half, c.y - half, handleSize, handleSize);
      ctx.strokeRect(c.x - half, c.y - half, handleSize, handleSize);
    }

    ctx.restore();
  }

  private drawNode(node: CanvasNode, isDark: boolean, defaultStroke: string) {
    const colors = this.resolveColor(node.color || "default", isDark);
    const font = node.fontFamily || this.defaultFont;
    const fillColor = node.customFill || colors.fill;
    const strokeColor = node.customStroke || colors.border;
    const strokeWidth = node.strokeWidth || (node.status === "active" ? 2.5 : 1.8);
    const dash =
      node.strokeStyle === "dashed"
        ? [6, 4]
        : node.strokeStyle === "dotted"
        ? [2, 3]
        : [];
    const strokeOpts = {
      strokeColor,
      strokeWidth,
      roughness: 0.85,
      dash,
    };

    // Check 1: Custom Freeform SVG Path from AI
    if (node.svgPath) {
      this.renderer.drawCustomSvgPath(
        node.x,
        node.y,
        node.width,
        node.height,
        node.svgPath,
        fillColor,
        strokeOpts
      );
    }
    // Check 2: Custom Polygon from AI
    else if (node.points && Array.isArray(node.points) && node.points.length >= 3) {
      const pts = (node.points as any[]).map((p: any) => {
        if (Array.isArray(p)) return { x: node.x + p[0], y: node.y + p[1] };
        return { x: node.x + p.x, y: node.y + p.y };
      });
      this.renderer.drawPolygon(pts, fillColor, strokeOpts);
    }
    // Check 3: Standard & Extended Architecture Shapes
    else {
      switch (node.type) {
        case "sticky":
          this.renderer.drawStickyNote(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            { ...strokeOpts, strokeWidth: 1.6 }
          );
          break;

        case "decision":
        case "diamond":
        case "condition":
          this.renderer.drawDiamond(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "database":
        case "db":
        case "disk":
        case "storage":
          this.renderer.drawCylinder(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "cloud":
        case "k8s":
        case "kubernetes":
        case "cluster":
        case "network":
          this.renderer.drawCloud(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "circle":
          this.renderer.drawCircle(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "capsule":
        case "pill":
        case "endpoint":
          this.renderer.drawCapsule(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "queue":
        case "stream":
        case "buffer":
        case "kafka":
          this.renderer.drawQueue(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "actor":
        case "user":
        case "person":
        case "client":
          this.renderer.drawActor(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "hexagon":
          this.renderer.drawHexagon(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "triangle":
          this.renderer.drawTriangle(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "parallelogram":
          this.renderer.drawParallelogram(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "trapezoid":
          this.renderer.drawTrapezoid(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "server":
        case "rack":
        case "host":
        case "backend":
          this.renderer.drawServer(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "browser":
        case "web":
        case "ui":
        case "frontend":
          this.renderer.drawBrowser(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "mobile":
        case "phone":
        case "app":
          this.renderer.drawMobile(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "folder":
        case "package":
        case "directory":
        case "module":
          this.renderer.drawFolder(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "shield":
        case "firewall":
        case "security":
        case "auth":
          this.renderer.drawShield(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "terminal":
        case "console":
        case "cli":
        case "bash":
          this.renderer.drawTerminal(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;

        case "card":
        case "step":
        default:
          this.renderer.drawRect(
            node.x,
            node.y,
            node.width,
            node.height,
            fillColor,
            strokeOpts
          );
          break;
      }
    }

    if (node.status && node.status !== "none") {
      this.drawStatusBadge(node, isDark, font);
    }

    this.drawNodeContent(node, colors.text, font);
  }

  private drawStatusBadge(node: CanvasNode, isDark: boolean, font: FontFamily) {
    const ctx = this.ctx;
    const badgeText = node.badge || node.status?.toUpperCase() || "";
    if (!badgeText) return;

    let badgeBg = isDark ? "#27272a" : "#e4e4e7";
    let badgeColor = isDark ? "#a1a1aa" : "#52525b";

    if (node.status === "completed") {
      badgeBg = isDark ? "#14532d" : "#dcfce7";
      badgeColor = isDark ? "#86efac" : "#166534";
    } else if (node.status === "active") {
      badgeBg = isDark ? "#1e3a8a" : "#dbeafe";
      badgeColor = isDark ? "#93c5fd" : "#1e40af";
    } else if (node.status === "warning") {
      badgeBg = isDark ? "#713f12" : "#fef3c7";
      badgeColor = isDark ? "#fde047" : "#854d0e";
    } else if (node.status === "error") {
      badgeBg = isDark ? "#7f1d1d" : "#fee2e2";
      badgeColor = isDark ? "#fca5a5" : "#991b1b";
    }

    ctx.save();
    ctx.font =
      font === "sans"
        ? "600 10px 'Inter', sans-serif"
        : "bold 11px 'Shantell Sans', 'Patrick Hand', sans-serif";
    const textW = ctx.measureText(badgeText).width;
    const pillW = textW + 12;
    const pillH = 18;
    const pillX = node.x + node.width - pillW - 8;
    const pillY = node.y + 8;

    ctx.fillStyle = badgeBg;
    ctx.fillRect(pillX, pillY, pillW, pillH);

    this.renderer.drawRect(pillX, pillY, pillW, pillH, undefined, {
      strokeColor: badgeColor,
      strokeWidth: 1,
      roughness: 0.5,
    });

    ctx.fillStyle = badgeColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, pillX + pillW / 2, pillY + pillH / 2);
    ctx.restore();
  }

  private drawNodeContent(node: CanvasNode, textColor: string, font: FontFamily) {
    const isSticky = node.type === "sticky";
    const paddingX = 14;
    let currentY =
      node.y +
      (isSticky
        ? 14
        : node.type === "browser"
        ? 34
        : node.type === "folder"
        ? 22
        : node.type === "shield"
        ? 22
        : 12);
    const maxW = Math.max(20, node.width - paddingX * 2);

    const hasIcon = Boolean(node.icon);
    const iconWidth = hasIcon ? 28 : 0;

    if (hasIcon) {
      this.ctx.save();
      this.ctx.font = "20px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "top";
      this.ctx.fillText(node.icon!, node.x + paddingX, currentY);
      this.ctx.restore();
    }

    if (node.title) {
      currentY = this.renderer.drawText(
        node.title,
        node.x + paddingX + iconWidth,
        currentY,
        maxW - (node.status && node.status !== "none" ? 55 : 0) - iconWidth,
        19,
        17,
        textColor,
        "bold",
        font
      );
      currentY += 4;
    } else if (hasIcon) {
      currentY += 26;
    }

    if (node.text) {
      this.renderer.drawText(
        node.text,
        node.x + paddingX,
        currentY,
        maxW,
        17,
        14,
        textColor,
        "normal",
        font
      );
    }
  }

  private resolveColor(
    colorName: string,
    isDark: boolean
  ): { fill: string; border: string; text: string } {
    if (
      colorName &&
      (colorName.startsWith("#") ||
        colorName.startsWith("rgb") ||
        colorName.startsWith("hsl"))
    ) {
      return {
        fill: isDark ? "#18181b" : "#ffffff",
        border: colorName,
        text: isDark ? "#f4f4f5" : "#18181b",
      };
    }

    const palette: Record<
      string,
      { dark: { fill: string; border: string; text: string }; light: { fill: string; border: string; text: string } }
    > = {
      default: {
        dark: { fill: "#18181b", border: "#3f3f46", text: "#f4f4f5" },
        light: { fill: "#ffffff", border: "#d4d4d8", text: "#18181b" },
      },
      blue: {
        dark: { fill: "#172554", border: "#3b82f6", text: "#dbeafe" },
        light: { fill: "#eff6ff", border: "#60a5fa", text: "#1e3a8a" },
      },
      green: {
        dark: { fill: "#052e16", border: "#22c55e", text: "#dcfce7" },
        light: { fill: "#f0fdf4", border: "#4ade80", text: "#14532d" },
      },
      amber: {
        dark: { fill: "#451a03", border: "#f59e0b", text: "#fef3c7" },
        light: { fill: "#fffbeb", border: "#fcd34d", text: "#78350f" },
      },
      purple: {
        dark: { fill: "#3b0764", border: "#a855f7", text: "#f3e8ff" },
        light: { fill: "#faf5ff", border: "#c084fc", text: "#581c87" },
      },
      rose: {
        dark: { fill: "#4c0519", border: "#f43f5e", text: "#ffe4e6" },
        light: { fill: "#fff1f2", border: "#fb7185", text: "#881337" },
      },
      yellow: {
        dark: { fill: "#422006", border: "#eab308", text: "#fef08a" },
        light: { fill: "#fef9c3", border: "#facc15", text: "#713f12" },
      },
    };

    const entry = palette[colorName] || palette.default;
    return isDark ? entry.dark : entry.light;
  }

  private startAnimationLoop() {
    let lastTime = performance.now();
    const animate = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      this.animOffset = (this.animOffset + dt * 0.4) % 1.0;
      this.render();
      this.animFrameId = requestAnimationFrame(animate);
    };

    this.animFrameId = requestAnimationFrame(animate);
  }

  public destroy() {
    cancelAnimationFrame(this.animFrameId);
    this.resizeObserver?.disconnect();
  }

  private findResizeHandleAt(
    node: CanvasNode,
    wx: number,
    wy: number
  ): ResizeHandle | null {
    const hitRadius = 12 / this.zoom;

    const corners: { handle: ResizeHandle; x: number; y: number }[] = [
      { handle: "tl", x: node.x - 4, y: node.y - 4 },
      { handle: "tr", x: node.x + node.width + 4, y: node.y - 4 },
      { handle: "br", x: node.x + node.width + 4, y: node.y + node.height + 4 },
      { handle: "bl", x: node.x - 4, y: node.y + node.height + 4 },
    ];

    for (const c of corners) {
      if (Math.hypot(wx - c.x, wy - c.y) <= hitRadius) {
        return c.handle;
      }
    }
    return null;
  }

  private setupEventListeners() {
    const c = this.canvas;

    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.screenToWorld(sx, sy);

      // Pan tool or middle click or space key
      if (e.button === 1 || this.currentTool === "pan" || e.spaceKey) {
        this.isDragging = true;
        this.dragStartX = sx;
        this.dragStartY = sy;
        c.style.cursor = "grabbing";
        return;
      }

      // ERASER TOOL (Click or swipe to erase nodes or arrows)
      if (this.currentTool === "eraser") {
        this.isErasing = true;
        this.hasErasedInCurrentStroke = false;
        this.eraserTrail = [{ x: world.x, y: world.y }];
        this.eraseAtPoint(world.x, world.y);
        return;
      }

      // ARROW TOOL (Drag from anywhere to anywhere)
      if (this.currentTool === "arrow") {
        this.isDrawingArrow = true;
        this.arrowDragStart = { x: world.x, y: world.y };
        this.arrowCurrentEnd = { x: world.x, y: world.y };
        const startNode = this.findNodeAt(world.x, world.y);
        this.arrowStartNodeId = startNode ? startNode.id : null;
        this.hoverTargetNodeId = null;
        this.render();
        return;
      }

      // SELECT TOOL
      if (this.currentTool === "select") {
        // 1. Check resize handle on selected node
        const selectedNode = this.getSelectedNode();
        if (selectedNode) {
          const handle = this.findResizeHandleAt(selectedNode, world.x, world.y);
          if (handle) {
            this.resizingHandle = handle;
            this.resizeNodeStartRect = {
              x: selectedNode.x,
              y: selectedNode.y,
              w: selectedNode.width,
              h: selectedNode.height,
            };
            this.resizeMouseStartX = world.x;
            this.resizeMouseStartY = world.y;
            this.recordHistory();
            return;
          }
        }

        // 2. Check handle on selected edge
        if (
          this.selectedEdgeIndex !== null &&
          this.plan.edges &&
          this.plan.edges[this.selectedEdgeIndex]
        ) {
          const selectedEdge = this.plan.edges[this.selectedEdgeIndex];
          const edgeHandle = this.findEdgeHandleAt(selectedEdge, world.x, world.y);
          if (edgeHandle) {
            this.edgeDraggingHandle = edgeHandle;
            this.recordHistory();
            return;
          }
        }

        // 3. Check hit on node
        const hitNode = this.findNodeAt(world.x, world.y);
        if (hitNode) {
          this.setSelectedNodeId(hitNode.id);
          this.selectedEdgeIndex = null;
          this.draggingNode = hitNode;
          this.nodeDragOffsetX = world.x - hitNode.x;
          this.nodeDragOffsetY = world.y - hitNode.y;
          this.isDragging = true;
          this.recordHistory();
          c.style.cursor = "move";
          this.render();
          return;
        }

        // 4. Check hit on edge
        const hitEdgeIdx = this.findEdgeAt(world.x, world.y);
        if (hitEdgeIdx !== null) {
          this.selectedEdgeIndex = hitEdgeIdx;
          this.setSelectedNodeId(null);
          this.render();
          return;
        }

        // 5. Blank space clicked -> deselect and pan
        this.setSelectedNodeId(null);
        this.selectedEdgeIndex = null;
        this.isDragging = true;
        this.dragStartX = sx;
        this.dragStartY = sy;
        c.style.cursor = "grabbing";
        this.render();
      }
    });

    c.addEventListener("pointermove", (e) => {
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.screenToWorld(sx, sy);

      // ERASER dragging (Swipe erase)
      if (this.isErasing) {
        this.eraserTrail.push({ x: world.x, y: world.y });
        if (this.eraserTrail.length > 30) this.eraserTrail.shift();
        this.eraseAtPoint(world.x, world.y);
        this.render();
        return;
      }

      // ARROW drawing live drag
      if (this.isDrawingArrow && this.arrowDragStart) {
        this.arrowCurrentEnd = { x: world.x, y: world.y };
        const hovered = this.findNodeAt(world.x, world.y);
        this.hoverTargetNodeId = hovered ? hovered.id : null;
        this.render();
        return;
      }

      // EDGE handle dragging (customizing arrow length / angle / target)
      if (
        this.edgeDraggingHandle &&
        this.selectedEdgeIndex !== null &&
        this.plan.edges &&
        this.plan.edges[this.selectedEdgeIndex]
      ) {
        const edge = this.plan.edges[this.selectedEdgeIndex];
        const hovered = this.findNodeAt(world.x, world.y);

        if (this.edgeDraggingHandle === "end") {
          if (hovered && hovered.id !== edge.from) {
            edge.to = hovered.id;
            delete edge.endX;
            delete edge.endY;
          } else {
            delete edge.to;
            edge.endX = Math.round(world.x);
            edge.endY = Math.round(world.y);
          }
        } else if (this.edgeDraggingHandle === "start") {
          if (hovered && hovered.id !== edge.to) {
            edge.from = hovered.id;
            delete edge.startX;
            delete edge.startY;
          } else {
            delete edge.from;
            edge.startX = Math.round(world.x);
            edge.startY = Math.round(world.y);
          }
        }
        this.render();
        return;
      }

      // Handle Node Resizing
      if (this.resizingHandle && this.resizeNodeStartRect) {
        const node = this.getSelectedNode();
        if (node) {
          const dx = world.x - this.resizeMouseStartX;
          const dy = world.y - this.resizeMouseStartY;
          const start = this.resizeNodeStartRect;

          let newX = start.x;
          let newY = start.y;
          let newW = start.w;
          let newH = start.h;

          switch (this.resizingHandle) {
            case "br":
              newW = Math.max(70, start.w + dx);
              newH = Math.max(45, start.h + dy);
              break;
            case "bl":
              newW = Math.max(70, start.w - dx);
              newX = start.x + (start.w - newW);
              newH = Math.max(45, start.h + dy);
              break;
            case "tr":
              newW = Math.max(70, start.w + dx);
              newH = Math.max(45, start.h - dy);
              newY = start.y + (start.h - newH);
              break;
            case "tl":
              newW = Math.max(70, start.w - dx);
              newX = start.x + (start.w - newW);
              newH = Math.max(45, start.h - dy);
              newY = start.y + (start.h - newH);
              break;
          }

          node.x = Math.round(newX);
          node.y = Math.round(newY);
          node.width = Math.round(newW);
          node.height = Math.round(newH);
          this.render();
        }
        return;
      }

      // Handle Dragging / Moving Node
      if (this.isDragging) {
        if (this.draggingNode) {
          this.draggingNode.x = Math.round(world.x - this.nodeDragOffsetX);
          this.draggingNode.y = Math.round(world.y - this.nodeDragOffsetY);
          this.render();
        } else {
          // Panning viewport
          const dx = sx - this.dragStartX;
          const dy = sy - this.dragStartY;
          this.panX += dx;
          this.panY += dy;
          this.dragStartX = sx;
          this.dragStartY = sy;
          this.render();
        }
        return;
      }

      // Cursor hover updates
      if (this.currentTool === "eraser") {
        c.style.cursor = "cell";
        return;
      } else if (this.currentTool === "arrow") {
        c.style.cursor = "crosshair";
        return;
      } else if (this.currentTool === "pan") {
        c.style.cursor = "grab";
        return;
      }

      // Hover on edge handles
      if (
        this.selectedEdgeIndex !== null &&
        this.plan.edges &&
        this.plan.edges[this.selectedEdgeIndex]
      ) {
        const edgeHandle = this.findEdgeHandleAt(
          this.plan.edges[this.selectedEdgeIndex],
          world.x,
          world.y
        );
        if (edgeHandle) {
          c.style.cursor = "crosshair";
          return;
        }
      }

      // Hover on node resize handles
      const selectedNode = this.getSelectedNode();
      if (selectedNode) {
        const handle = this.findResizeHandleAt(selectedNode, world.x, world.y);
        if (handle === "tl" || handle === "br") {
          c.style.cursor = "nwse-resize";
          return;
        } else if (handle === "tr" || handle === "bl") {
          c.style.cursor = "nesw-resize";
          return;
        }
      }

      const hit = this.findNodeAt(world.x, world.y);
      if (hit) {
        c.style.cursor = "move";
      } else {
        const hitEdge = this.findEdgeAt(world.x, world.y);
        if (hitEdge !== null) {
          c.style.cursor = "pointer";
        } else {
          c.style.cursor = "default";
        }
      }
    });

    c.addEventListener("pointerup", (e) => {
      try {
        c.releasePointerCapture(e.pointerId);
      } catch {}

      // Finished ERASING stroke
      if (this.isErasing) {
        this.isErasing = false;
        this.eraserTrail = [];
        if (this.hasErasedInCurrentStroke) {
          this.hasErasedInCurrentStroke = false;
          this.notifyPlanChange();
        }
        this.updateCursor();
        this.render();
        return;
      }

      // Finished ARROW drawing
      if (this.isDrawingArrow && this.arrowDragStart && this.arrowCurrentEnd) {
        const p1 = this.arrowDragStart;
        const p2 = this.arrowCurrentEnd;
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        if (dist >= 12) {
          this.recordHistory();
          if (!this.plan.edges) this.plan.edges = [];
          const endNode = this.findNodeAt(p2.x, p2.y);
          const newEdge: CanvasEdge = {
            id: "edge-" + Math.random().toString(36).substr(2, 6),
            style: "animated",
            routing: "straight",
          };

          if (this.arrowStartNodeId) {
            newEdge.from = this.arrowStartNodeId;
          } else {
            newEdge.startX = Math.round(p1.x);
            newEdge.startY = Math.round(p1.y);
          }

          if (endNode && endNode.id !== this.arrowStartNodeId) {
            newEdge.to = endNode.id;
          } else {
            newEdge.endX = Math.round(p2.x);
            newEdge.endY = Math.round(p2.y);
          }

          this.plan.edges.push(newEdge);
          this.selectedEdgeIndex = this.plan.edges.length - 1;
          this.selectedNodeId = null;
          this.notifyPlanChange();
        }

        this.isDrawingArrow = false;
        this.arrowDragStart = null;
        this.arrowCurrentEnd = null;
        this.arrowStartNodeId = null;
        this.hoverTargetNodeId = null;
        this.updateCursor();
        this.render();
        return;
      }

      // Finished Edge Handle Dragging
      if (this.edgeDraggingHandle) {
        this.edgeDraggingHandle = null;
        this.notifyPlanChange();
        this.render();
        return;
      }

      // Finished Node Resizing
      if (this.resizingHandle) {
        this.resizingHandle = null;
        this.resizeNodeStartRect = null;
        this.notifyPlanChange();
      }

      // Finished dragging / panning
      if (this.isDragging) {
        this.isDragging = false;
        if (this.draggingNode) {
          this.draggingNode = null;
          this.notifyPlanChange();
        }
      }

      this.updateCursor();
    });

    // Double-click triggers in-place inline text editing
    c.addEventListener("dblclick", (e) => {
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.screenToWorld(sx, sy);
      const hit = this.findNodeAt(world.x, world.y);

      if (hit) {
        this.setSelectedNodeId(hit.id);
        const screenTopLeft = this.worldToScreen(hit.x, hit.y);
        const screenW = hit.width * this.zoom;
        const screenH = hit.height * this.zoom;

        if (this.onInlineEditTriggerCallback) {
          this.onInlineEditTriggerCallback(hit, {
            x: screenTopLeft.x,
            y: screenTopLeft.y,
            w: screenW,
            h: screenH,
          });
        }
      }
    });

    // Wheel Zoom & Pan
    c.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const rect = c.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        if (e.ctrlKey || e.metaKey) {
          const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
          this.setZoom(this.zoom * zoomFactor, sx, sy);
        } else {
          this.panX -= e.deltaX;
          this.panY -= e.deltaY;
          this.render();
        }
      },
      { passive: false }
    );
  }

  private findNodeAt(wx: number, wy: number): CanvasNode | null {
    for (let i = this.plan.nodes.length - 1; i >= 0; i--) {
      const n = this.plan.nodes[i];
      if (
        wx >= n.x &&
        wx <= n.x + n.width &&
        wy >= n.y &&
        wy <= n.y + n.height
      ) {
        return n;
      }
    }
    return null;
  }

  public createNodeAt(type: NodeType, wx: number, wy: number): CanvasNode {
    this.recordHistory();
    const id = "node-" + Math.random().toString(36).substr(2, 6);
    let width = 210;
    let height = 105;
    let title = "New Step";
    let text = "Notes or details...";
    let color = "default";

    switch (type) {
      case "sticky":
        width = 170;
        height = 140;
        title = "Sticky Note";
        text = "Quick note";
        color = "yellow";
        break;
      case "decision":
        width = 160;
        height = 110;
        title = "Condition?";
        text = "";
        color = "amber";
        break;
      case "database":
        width = 170;
        height = 120;
        title = "Database";
        text = "Relational store";
        color = "blue";
        break;
      case "cloud":
        width = 220;
        height = 120;
        title = "Cloud Cluster";
        text = "AWS / K8s";
        color = "purple";
        break;
      case "circle":
        width = 110;
        height = 110;
        title = "State";
        text = "";
        color = "green";
        break;
      case "capsule":
        width = 180;
        height = 60;
        title = "API Endpoint";
        text = "";
        color = "blue";
        break;
      case "queue":
        width = 180;
        height = 80;
        title = "Task Queue";
        text = "BullMQ / Redis";
        color = "rose";
        break;
      case "actor":
        width = 90;
        height = 130;
        title = "User";
        text = "";
        color = "default";
        break;
      case "hexagon":
        width = 160;
        height = 100;
        title = "Microservice";
        text = "";
        color = "blue";
        break;
      case "triangle":
        width = 130;
        height = 110;
        title = "Warning / Delta";
        text = "";
        color = "amber";
        break;
      case "parallelogram":
        width = 170;
        height = 80;
        title = "Input / Output";
        text = "";
        color = "blue";
        break;
      case "trapezoid":
        width = 170;
        height = 80;
        title = "Manual Operation";
        text = "";
        color = "purple";
        break;
      case "server":
        width = 180;
        height = 130;
        title = "App Server";
        text = "Cluster Node";
        color = "blue";
        break;
      case "browser":
        width = 240;
        height = 160;
        title = "Web Client";
        text = "React Frontend";
        color = "purple";
        break;
      case "mobile":
        width = 130;
        height = 190;
        title = "Mobile App";
        text = "iOS / Android";
        color = "rose";
        break;
      case "folder":
        width = 170;
        height = 110;
        title = "Module / Package";
        text = "";
        color = "amber";
        break;
      case "shield":
        width = 140;
        height = 150;
        title = "Auth / Firewall";
        text = "Security Gateway";
        color = "green";
        break;
      case "text":
        width = 200;
        height = 50;
        title = "Annotation";
        text = "";
        break;
    }

    const newNode: CanvasNode = {
      id,
      type,
      x: Math.round(wx - width / 2),
      y: Math.round(wy - height / 2),
      width,
      height,
      title,
      text,
      color,
      status: type === "card" || type === "step" ? "active" : "none",
    };

    this.plan.nodes.push(newNode);
    this.setSelectedNodeId(id);
    this.notifyPlanChange();
    return newNode;
  }

  private notifyPlanChange(record: boolean = true) {
    if (record) {
      this.recordHistory();
    }
    if (this.onPlanChangeCallback) {
      this.onPlanChangeCallback(this.plan);
    }
  }

  private notifySelectionChange(node: CanvasNode | null) {
    if (this.onSelectionChangeCallback) {
      this.onSelectionChangeCallback(node);
    }
  }
}
