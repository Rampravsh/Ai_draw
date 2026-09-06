export type NodeType =
  | "card"
  | "step"
  | "decision"
  | "database"
  | "cloud"
  | "circle"
  | "capsule"
  | "queue"
  | "actor"
  | "sticky"
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
  | "terminal"
  | "component"
  | "custom"
  | string;

export type NodeStatus = "todo" | "active" | "completed" | "warning" | "error" | "none" | string;
export type ArrowRouting = "straight" | "curved" | "elbow" | "zigzag" | string;
export type FontFamily = "handwritten" | "sans" | string;
export type TextLevel = "h1" | "h2" | "h3" | "p";

export interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  text?: string;
  color?: string; // Preset palette name or ANY hex (#...), rgb(...), hsl(...)
  status?: NodeStatus;
  badge?: string;
  fontFamily?: FontFamily;
  textLevel?: TextLevel; // "h1" (32px), "h2" (24px), "h3" (18px), "p" (14px)
  textColor?: string; // Custom direct text color
  icon?: string; // ANY custom emoji or icon symbol, e.g. "🚀", "⚡", "🔒", "🐳", "🧠", "📱"
  svgPath?: string; // ANY freeform SVG path d="..." for arbitrary vector shapes
  points?: { x: number; y: number }[] | [number, number][]; // ANY custom polygon points
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed" | "dotted" | string;
  customFill?: string;
  customStroke?: string;
  [key: string]: any; // Completely open for AI creative attributes
}

export interface CanvasEdge {
  id?: string;
  from: string;
  to: string;
  label?: string;
  style?: "solid" | "dashed" | "dotted" | "animated" | "neon" | string;
  routing?: ArrowRouting;
  color?: string;
  strokeWidth?: number;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  bidirectional?: boolean;
  bendOffset?: number; // for curved/elbow bend
  [key: string]: any; // Completely open for AI creative attributes
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
