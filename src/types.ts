export type NodeType =
  | "card"
  | "step"
  | "sticky"
  | "decision"
  | "database"
  | "cloud"
  | "circle"
  | "capsule"
  | "queue"
  | "actor"
  | "text"
  | "hexagon"
  | "triangle"
  | "parallelogram"
  | "trapezoid"
  | "server"
  | "browser"
  | "mobile"
  | "folder"
  | "shield"
  | "component"
  | "custom"
  | string;

export type NodeStatus = "todo" | "active" | "completed" | "warning" | "error" | "none";
export type ArrowRouting = "straight" | "curved" | "elbow";
export type FontFamily = "handwritten" | "sans";

export interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  text?: string;
  color?: string; // "default", "blue", "green", "amber", "purple", "rose", "yellow", or custom hex/rgb
  status?: NodeStatus;
  badge?: string;
  fontFamily?: FontFamily;
  icon?: string; // custom emoji or icon symbol, e.g. "🚀", "⚡", "🔒", "🐳"
  svgPath?: string; // custom freeform SVG path d="..."
  points?: { x: number; y: number }[] | [number, number][]; // custom polygon points
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed" | "dotted";
  customFill?: string;
  customStroke?: string;
}

export interface CanvasEdge {
  id?: string;
  from: string;
  to: string;
  label?: string;
  style?: "solid" | "dashed" | "animated";
  routing?: ArrowRouting;
  color?: string;
  bendOffset?: number; // for curved/elbow bend
}

export type GridMode = "graph" | "dots" | "blank";
export type ThemeMode = "dark" | "light";

export interface CanvasPlan {
  title: string;
  filename?: string;
  theme?: ThemeMode;
  grid?: GridMode;
  fontFamily?: FontFamily;
  layout?: "auto" | "manual";
  nodes: CanvasNode[];
  edges?: CanvasEdge[];
  updatedAt?: string;
}

export interface DiagramFileInfo {
  filename: string;
  title: string;
  nodeCount: number;
  updatedAt?: string;
}

export interface WorkspaceInfo {
  name: string;
  path: string;
  isCurrent: boolean;
  diagramCount: number;
}

export interface WebviewToHostMessage {
  type:
    | "savePlan"
    | "requestSync"
    | "listDiagrams"
    | "switchDiagram"
    | "newDiagram"
    | "deleteDiagram"
    | "switchWorkspace"
    | "browseWorkspace"
    | "logActivity"
    | "log";
  plan?: CanvasPlan;
  filename?: string;
  title?: string;
  workspacePath?: string;
  activity?: {
    action: string;
    details: string;
    timestamp: string;
  };
}

export interface HostToWebviewMessage {
  type:
    | "syncPlan"
    | "setTheme"
    | "setGrid"
    | "clear"
    | "triggerExport"
    | "diagramListUpdate";
  plan?: CanvasPlan;
  theme?: ThemeMode;
  grid?: GridMode;
  diagrams?: string[];
  diagramDetails?: DiagramFileInfo[];
  activeDiagram?: string;
  workspaces?: WorkspaceInfo[];
  activeWorkspace?: WorkspaceInfo;
}
