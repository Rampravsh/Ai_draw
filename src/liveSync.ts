import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { CanvasPlan } from "./types";

export class LiveSyncService {
  private watcher?: vscode.FileSystemWatcher;
  public activeFilename: string = "plan.json";
  private isWritingFile: boolean = false;
  private onPlanUpdatedCallback?: (plan: CanvasPlan) => void;
  private onDiagramListChangedCallback?: (files: string[]) => void;

  constructor() {
    this.initWatcher();
  }

  public setOnPlanUpdated(cb: (plan: CanvasPlan) => void) {
    this.onPlanUpdatedCallback = cb;
  }

  public setOnDiagramListChanged(cb: (files: string[]) => void) {
    this.onDiagramListChangedCallback = cb;
  }

  public getAidrawDir(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return null;
    const rootPath = folders[0].uri.fsPath;
    const dirPath = path.join(rootPath, ".aidraw");

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

  public setActiveFilename(filename: string) {
    this.activeFilename = filename;
    this.initWatcher();
    const plan = this.readPlanFromFile(filename);
    if (plan && this.onPlanUpdatedCallback) {
      plan.filename = filename;
      this.onPlanUpdatedCallback(plan);
    }
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
        this.initWatcher();
        const plan = this.ensureInitialPlan();
        if (this.onPlanUpdatedCallback) {
          this.onPlanUpdatedCallback(plan);
        }
      }
      if (this.onDiagramListChangedCallback) {
        this.onDiagramListChangedCallback(files);
      }
      return true;
    } catch (err) {
      console.error("Failed to delete diagram file:", err);
      return false;
    }
  }

  public createNewDiagram(title: string): CanvasPlan {
    const dir = this.getAidrawDir();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const filename = `${slug || "diagram"}.json`;

    const newPlan: CanvasPlan = {
      title,
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
          width: 220,
          height: 100,
          title: "1. Initial Step",
          text: "Start designing your flow...",
          color: "blue",
          status: "active",
        },
      ],
      edges: [],
      updatedAt: new Date().toISOString(),
    };

    this.activeFilename = filename;
    this.writePlanToFile(newPlan, filename);
    this.initWatcher();

    if (this.onDiagramListChangedCallback) {
      this.onDiagramListChangedCallback(this.listDiagramFiles());
    }

    return newPlan;
  }

  private initWatcher() {
    this.watcher?.dispose();
    const fileUri = this.getPlanFilePath(this.activeFilename);
    if (!fileUri) return;

    this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        path.dirname(fileUri.fsPath),
        this.activeFilename
      )
    );

    let debounceTimer: NodeJS.Timeout | null = null;
    const handleFileChange = () => {
      if (this.isWritingFile) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const plan = this.readPlanFromFile(this.activeFilename);
        if (plan && this.onPlanUpdatedCallback) {
          plan.filename = this.activeFilename;
          this.onPlanUpdatedCallback(plan);
        }
      }, 100);
    };

    this.watcher.onDidChange(handleFileChange);
    this.watcher.onDidCreate(handleFileChange);
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
