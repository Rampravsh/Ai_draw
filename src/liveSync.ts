import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { CanvasPlan, DiagramFileInfo, WorkspaceInfo } from "./types";

export class LiveSyncService {
  private watcher?: vscode.FileSystemWatcher;
  public activeFilename: string = "plan.json";
  public activeWorkspacePath: string | null = null;
  public activeWorkspaceName: string = "Workspace";
  private recentWorkspaces: Set<string> = new Set();
  private isWritingFile: boolean = false;
  private onPlanUpdatedCallback?: (plan: CanvasPlan) => void;
  private onDiagramListChangedCallback?: (
    files: string[],
    details: DiagramFileInfo[],
    workspaces: WorkspaceInfo[],
    activeWorkspace: WorkspaceInfo
  ) => void;

  constructor(initialWorkspacePath?: string) {
    if (initialWorkspacePath && fs.existsSync(initialWorkspacePath)) {
      this.activeWorkspacePath = initialWorkspacePath;
      this.activeWorkspaceName = path.basename(initialWorkspacePath);
      this.recentWorkspaces.add(initialWorkspacePath);
    } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      this.activeWorkspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      this.activeWorkspaceName = vscode.workspace.workspaceFolders[0].name;
      vscode.workspace.workspaceFolders.forEach((f) => this.recentWorkspaces.add(f.uri.fsPath));
    }

    this.initWatcher();
  }

  public setOnPlanUpdated(cb: (plan: CanvasPlan) => void) {
    this.onPlanUpdatedCallback = cb;
  }

  public setOnDiagramListChanged(
    cb: (
      files: string[],
      details: DiagramFileInfo[],
      workspaces: WorkspaceInfo[],
      activeWorkspace: WorkspaceInfo
    ) => void
  ) {
    this.onDiagramListChangedCallback = cb;
  }

  public getAidrawDir(customWorkspacePath?: string): string | null {
    const wsPath = customWorkspacePath || this.activeWorkspacePath;
    if (!wsPath) {
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        this.activeWorkspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        this.activeWorkspaceName = vscode.workspace.workspaceFolders[0].name;
        this.recentWorkspaces.add(this.activeWorkspacePath);
      } else {
        return null;
      }
    }

    const dirPath = path.join(this.activeWorkspacePath!, ".aidraw");
    if (!fs.existsSync(dirPath)) {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
      } catch (err) {
        console.error("Failed to create .aidraw folder", err);
      }
    }
    return dirPath;
  }

  public getPlanFilePath(filename: string = this.activeFilename): vscode.Uri | null {
    const dir = this.getAidrawDir();
    if (!dir) return null;
    return vscode.Uri.file(path.join(dir, filename));
  }

  public getAvailableWorkspaces(): WorkspaceInfo[] {
    const map = new Map<string, WorkspaceInfo>();

    // 1. All open workspace folders in VS Code
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        const p = folder.uri.fsPath;
        this.recentWorkspaces.add(p);
        map.set(p, {
          name: folder.name,
          path: p,
          isCurrent: p === this.activeWorkspacePath,
          diagramCount: this.countDiagramsInPath(p),
        });
      }
    }

    // 2. Any recent workspaces user switched to or opened
    for (const p of this.recentWorkspaces) {
      if (!map.has(p) && fs.existsSync(p)) {
        map.set(p, {
          name: path.basename(p),
          path: p,
          isCurrent: p === this.activeWorkspacePath,
          diagramCount: this.countDiagramsInPath(p),
        });
      }
    }

    // Ensure active workspace is in list
    if (this.activeWorkspacePath && !map.has(this.activeWorkspacePath)) {
      map.set(this.activeWorkspacePath, {
        name: this.activeWorkspaceName,
        path: this.activeWorkspacePath,
        isCurrent: true,
        diagramCount: this.countDiagramsInPath(this.activeWorkspacePath),
      });
    }

    return Array.from(map.values());
  }

  public getActiveWorkspaceInfo(): WorkspaceInfo {
    const p = this.activeWorkspacePath || "";
    return {
      name: this.activeWorkspaceName || (p ? path.basename(p) : "Workspace"),
      path: p,
      isCurrent: true,
      diagramCount: p ? this.countDiagramsInPath(p) : 0,
    };
  }

  private countDiagramsInPath(wsPath: string): number {
    try {
      const dir = path.join(wsPath, ".aidraw");
      if (!fs.existsSync(dir)) return 0;
      const files = fs.readdirSync(dir);
      return files.filter((f) => f.endsWith(".json") && f !== "activity.json").length;
    } catch {
      return 0;
    }
  }

  public setActiveWorkspace(workspacePath: string, preferredFilename?: string) {
    if (!fs.existsSync(workspacePath)) return;

    this.activeWorkspacePath = workspacePath;
    this.activeWorkspaceName = path.basename(workspacePath);
    this.recentWorkspaces.add(workspacePath);

    // Switch active diagram in this workspace
    const diagrams = this.listDiagramFiles();
    if (preferredFilename && diagrams.includes(preferredFilename)) {
      this.activeFilename = preferredFilename;
    } else if (diagrams.length > 0) {
      this.activeFilename = diagrams[0];
    } else {
      this.activeFilename = "plan.json";
    }

    this.initWatcher();

    // Load active diagram
    const plan = this.readPlanFromFile(this.activeFilename) || this.ensureInitialPlan();
    if (this.onPlanUpdatedCallback) {
      this.onPlanUpdatedCallback(plan);
    }

    this.notifyDiagramListChanged();
  }

  public listDiagramFiles(): string[] {
    const dir = this.getAidrawDir();
    if (!dir || !fs.existsSync(dir)) return ["plan.json"];

    try {
      const files = fs.readdirSync(dir);
      const jsonFiles = files.filter(
        (f) => f.endsWith(".json") && f !== "activity.json"
      );
      if (jsonFiles.length === 0) {
        return ["plan.json"];
      }
      return jsonFiles;
    } catch {
      return ["plan.json"];
    }
  }

  public listDiagramDetails(): DiagramFileInfo[] {
    const dir = this.getAidrawDir();
    if (!dir || !fs.existsSync(dir)) {
      return [{ filename: "plan.json", title: "Project Plan", nodeCount: 0 }];
    }

    const files = this.listDiagramFiles();
    const details: DiagramFileInfo[] = [];

    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const raw = fs.readFileSync(fullPath, "utf-8");
        const parsed = JSON.parse(raw);
        details.push({
          filename: file,
          title: parsed.title || file.replace(/\.json$/, "").replace(/-/g, " "),
          nodeCount: Array.isArray(parsed.nodes) ? parsed.nodes.length : 0,
          updatedAt: parsed.updatedAt,
        });
      } catch {
        details.push({
          filename: file,
          title: file.replace(/\.json$/, "").replace(/-/g, " "),
          nodeCount: 0,
        });
      }
    }

    // Sort: plan.json first, then alphabetical
    details.sort((a, b) => {
      if (a.filename === "plan.json") return -1;
      if (b.filename === "plan.json") return 1;
      return a.title.localeCompare(b.title);
    });

    return details;
  }

  public setActiveFilename(filename: string) {
    this.activeFilename = filename;
    const plan = this.readPlanFromFile(filename) || this.ensureInitialPlan();
    if (this.onPlanUpdatedCallback) {
      plan.filename = filename;
      this.onPlanUpdatedCallback(plan);
    }
    this.notifyDiagramListChanged();
  }

  public deleteDiagram(filename: string): boolean {
    const dir = this.getAidrawDir();
    if (!dir) return false;
    const filePath = path.join(dir, filename);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      const files = this.listDiagramFiles();
      if (this.activeFilename === filename) {
        this.activeFilename = files[0] || "plan.json";
        const plan = this.readPlanFromFile(this.activeFilename) || this.ensureInitialPlan();
        if (this.onPlanUpdatedCallback) {
          this.onPlanUpdatedCallback(plan);
        }
      }

      this.notifyDiagramListChanged();
      return true;
    } catch (err) {
      console.error("Failed to delete diagram file:", err);
      return false;
    }
  }

  /**
   * User or AI creates a new diagram.
   * User only gives the title (e.g. "User Auth Flow") without writing .json!
   */
  public createNewDiagram(title: string): CanvasPlan {
    const dir = this.getAidrawDir();
    const cleanTitle = (title || "New Diagram").trim().replace(/\.json$/i, "");
    let slug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) slug = "diagram";

    let filename = `${slug}.json`;
    if (dir) {
      let counter = 2;
      while (fs.existsSync(path.join(dir, filename))) {
        filename = `${slug}-${counter}.json`;
        counter++;
      }
    }

    const newPlan: CanvasPlan = {
      title: cleanTitle,
      filename,
      theme: "dark",
      grid: "graph",
      fontFamily: "handwritten",
      layout: "auto",
      nodes: [
        {
          id: "step-1",
          type: "card",
          x: 120,
          y: 150,
          width: 240,
          height: 100,
          title: cleanTitle,
          text: "Start designing your architecture here...",
          color: "blue",
          status: "active",
        },
      ],
      edges: [],
      updatedAt: new Date().toISOString(),
    };

    this.activeFilename = filename;
    this.writePlanToFile(newPlan, filename);

    if (this.onPlanUpdatedCallback) {
      this.onPlanUpdatedCallback(newPlan);
    }
    this.notifyDiagramListChanged();

    return newPlan;
  }

  private initWatcher() {
    this.watcher?.dispose();
    const aidrawDir = this.getAidrawDir();
    if (!aidrawDir) return;

    // Watch all *.json files in .aidraw folder
    this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(aidrawDir, "*.json")
    );

    let debounceTimer: NodeJS.Timeout | null = null;
    const handleFileEvent = (uri: vscode.Uri) => {
      if (this.isWritingFile) return;
      const basename = path.basename(uri.fsPath);
      if (basename === "activity.json") return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // If changed file is the active diagram -> update canvas
        if (basename === this.activeFilename) {
          const plan = this.readPlanFromFile(this.activeFilename);
          if (plan && this.onPlanUpdatedCallback) {
            plan.filename = this.activeFilename;
            this.onPlanUpdatedCallback(plan);
          }
        }
        // Always refresh diagram list across webview
        this.notifyDiagramListChanged();
      }, 100);
    };

    this.watcher.onDidChange(handleFileEvent);
    this.watcher.onDidCreate(handleFileEvent);
    this.watcher.onDidDelete(handleFileEvent);
  }

  public notifyDiagramListChanged() {
    if (this.onDiagramListChangedCallback) {
      const files = this.listDiagramFiles();
      const details = this.listDiagramDetails();
      const workspaces = this.getAvailableWorkspaces();
      const activeWs = this.getActiveWorkspaceInfo();
      this.onDiagramListChangedCallback(files, details, workspaces, activeWs);
    }
  }

  public readPlanFromFile(filename: string = this.activeFilename): CanvasPlan | null {
    const fileUri = this.getPlanFilePath(filename);
    if (!fileUri || !fs.existsSync(fileUri.fsPath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(fileUri.fsPath, "utf-8");
      const parsed: CanvasPlan = JSON.parse(raw);
      parsed.filename = filename;
      parsed.nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
      parsed.edges = Array.isArray(parsed.edges) ? parsed.edges : [];
      return parsed;
    } catch (err) {
      console.warn(`Could not parse ${filename}:`, err);
      return null;
    }
  }

  public writePlanToFile(plan: CanvasPlan, filename: string = this.activeFilename): boolean {
    const fileUri = this.getPlanFilePath(filename);
    if (!fileUri) return false;

    try {
      this.isWritingFile = true;
      plan.filename = filename;
      plan.updatedAt = new Date().toISOString();
      const content = JSON.stringify(plan, null, 2);
      fs.writeFileSync(fileUri.fsPath, content, "utf-8");
      setTimeout(() => {
        this.isWritingFile = false;
      }, 300);
      return true;
    } catch (err) {
      this.isWritingFile = false;
      console.error("Failed to write plan to file:", err);
      return false;
    }
  }

  public logActivity(activity: { action: string; details: string; timestamp: string }) {
    const dir = this.getAidrawDir();
    if (!dir) return;
    const logPath = path.join(dir, "activity.json");

    try {
      let logs: any[] = [];
      if (fs.existsSync(logPath)) {
        try {
          logs = JSON.parse(fs.readFileSync(logPath, "utf-8"));
        } catch {}
      }
      logs.push(activity);
      if (logs.length > 50) logs.shift();
      fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), "utf-8");
    } catch (e) {
      console.warn("Failed to write activity log:", e);
    }
  }

  public ensureInitialPlan(): CanvasPlan {
    const existing = this.readPlanFromFile(this.activeFilename);
    if (existing) return existing;

    const initialPlan: CanvasPlan = {
      title: "Project Architecture & Live Plan",
      filename: this.activeFilename,
      theme: "dark",
      grid: "graph",
      fontFamily: "handwritten",
      layout: "auto",
      nodes: [
        {
          id: "step-1",
          type: "card",
          x: 100,
          y: 160,
          width: 220,
          height: 100,
          title: "1. Getting Started",
          text: "Visual whiteboard live in IDE",
          color: "blue",
          status: "completed",
        },
      ],
      edges: [],
      updatedAt: new Date().toISOString(),
    };

    this.writePlanToFile(initialPlan, this.activeFilename);
    return initialPlan;
  }

  public dispose() {
    this.watcher?.dispose();
  }
}
