import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { LiveSyncService } from "./liveSync";
import { CanvasPlan, HostToWebviewMessage, WebviewToHostMessage } from "./types";

let currentPanel: vscode.WebviewPanel | undefined = undefined;
let liveSyncService: LiveSyncService | undefined = undefined;
let statusBarItem: vscode.StatusBarItem | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
  liveSyncService = new LiveSyncService();

  // Auto-provision the AI Live Draw skill on ANY machine upon extension installation/activation
  autoProvisionSkill(context);

  // Create Status Bar Item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "aiDraw.openCanvas";
  updateStatusBar();
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Helper to post full diagram & workspace state to webview
  function postFullState(panel: vscode.WebviewPanel) {
    if (!liveSyncService) return;
    panel.webview.postMessage({
      type: "diagramListUpdate",
      diagrams: liveSyncService.listDiagramFiles(),
      diagramDetails: liveSyncService.listDiagramDetails(),
      activeDiagram: liveSyncService.activeFilename,
      workspaces: liveSyncService.getAvailableWorkspaces(),
      activeWorkspace: liveSyncService.getActiveWorkspaceInfo(),
    });
  }

  // When active plan changes, push live update to Webview
  liveSyncService.setOnPlanUpdated((plan: CanvasPlan) => {
    if (currentPanel) {
      currentPanel.webview.postMessage({
        type: "syncPlan",
        plan,
      });
      postFullState(currentPanel);
    }
    updateStatusBar();
  });

  liveSyncService.setOnDiagramListChanged(() => {
    if (currentPanel) {
      postFullState(currentPanel);
    }
    updateStatusBar();
  });

  // Track active editor: if user opens a diagram file or file in another project, sync workspace
  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (!editor || !liveSyncService) return;
      const docPath = editor.document.uri.fsPath;
      if (docPath.includes(".aidraw")) {
        const parentDir = path.dirname(docPath);
        const wsDir = path.dirname(parentDir);
        const filename = path.basename(docPath);
        if (wsDir !== liveSyncService.activeWorkspacePath && fs.existsSync(docPath)) {
          liveSyncService.setActiveWorkspace(wsDir, filename);
          if (currentPanel) {
            postFullState(currentPanel);
          }
        } else if (filename !== liveSyncService.activeFilename && fs.existsSync(docPath)) {
          liveSyncService.setActiveFilename(filename);
        }
      }
    },
    null,
    context.subscriptions
  );

  // Command: Open Live Canvas
  const openCanvasCmd = vscode.commands.registerCommand(
    "aiDraw.openCanvas",
    () => {
      openLiveCanvasPanel(context);
    }
  );

  // Command: Initialize New Plan (user can just type title without .json)
  const newPlanCmd = vscode.commands.registerCommand(
    "aiDraw.newDiagram",
    async () => {
      const title = await vscode.window.showInputBox({
        prompt: "Enter title for new plan (e.g. Backend Architecture)",
        placeHolder: "Microservices Design",
      });
      if (title && liveSyncService) {
        liveSyncService.createNewDiagram(title);
        openLiveCanvasPanel(context);
      }
    }
  );

  // Command: Clear Canvas
  const clearCanvasCmd = vscode.commands.registerCommand(
    "aiDraw.clearCanvas",
    () => {
      if (currentPanel) {
        currentPanel.webview.postMessage({ type: "clear" });
      }
    }
  );

  // Command: Toggle Live Sync
  const toggleSyncCmd = vscode.commands.registerCommand(
    "aiDraw.toggleSync",
    () => {
      vscode.window.showInformationMessage(
        "AI Draw Live Sync is actively monitoring workspace diagrams"
      );
    }
  );

  // Command: Setup AI Assistant Skill
  const setupSkillCmd = vscode.commands.registerCommand(
    "aiDraw.setupSkill",
    () => {
      const count = autoProvisionSkill(context, true);
      vscode.window.showInformationMessage(
        `🎨 AI Live Draw skill successfully configured in ${count} location(s)! Your AI assistant can now live-draw plans in any project.`
      );
    }
  );

  context.subscriptions.push(
    openCanvasCmd,
    newPlanCmd,
    clearCanvasCmd,
    toggleSyncCmd,
    setupSkillCmd
  );
}

function updateStatusBar() {
  if (!statusBarItem) return;
  const wsName = liveSyncService?.activeWorkspaceName || "Workspace";
  const fileName = liveSyncService?.activeFilename || "plan.json";
  statusBarItem.text = `$(paintcan) AI Draw: ${wsName} / ${fileName}`;
  statusBarItem.tooltip = `AI Live Draw | Active: ${wsName} -> ${fileName}`;
}

// Automatically configures the AI Live Draw skill so ANY user's AI assistant immediately detects and uses it
function autoProvisionSkill(context: vscode.ExtensionContext, showToast: boolean = false): number {
  let provisionCount = 0;
  const embeddedSkillPath = path.join(context.extensionPath, "dist", "SKILL.md");
  let skillContent = "";

  if (fs.existsSync(embeddedSkillPath)) {
    skillContent = fs.readFileSync(embeddedSkillPath, "utf-8");
  } else {
    const srcSkillPath = path.join(context.extensionPath, "src", "resources", "SKILL.md");
    if (fs.existsSync(srcSkillPath)) {
      skillContent = fs.readFileSync(srcSkillPath, "utf-8");
    }
  }

  if (!skillContent) return 0;

  try {
    // 1. Install to Global Customizations Root if available (~/.gemini/config/skills)
    const homeDir = os.homedir();
    const globalConfigPath = path.join(homeDir, ".gemini", "config");
    if (fs.existsSync(globalConfigPath)) {
      const globalSkillsDir = path.join(globalConfigPath, "skills", "ai-live-draw");
      if (!fs.existsSync(globalSkillsDir)) {
        fs.mkdirSync(globalSkillsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(globalSkillsDir, "SKILL.md"), skillContent, "utf-8");
      provisionCount++;
    }

    // 2. Install to active Workspace (.agents/skills/ai-live-draw)
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      const wsRoot = folders[0].uri.fsPath;
      const wsSkillsDir = path.join(wsRoot, ".agents", "skills", "ai-live-draw");
      if (!fs.existsSync(wsSkillsDir)) {
        fs.mkdirSync(wsSkillsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(wsSkillsDir, "SKILL.md"), skillContent, "utf-8");
      provisionCount++;
    }

    if (showToast) {
      console.log(`[AI Draw] Auto-provisioned skill in ${provisionCount} location(s)`);
    }
  } catch (err) {
    console.warn("[AI Draw] Failed to auto-provision AI skill:", err);
  }

  return provisionCount;
}

function openLiveCanvasPanel(context: vscode.ExtensionContext) {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    "aiDrawCanvas",
    "AI Live Draw",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, "dist")),
      ],
    }
  );

  currentPanel.webview.html = getWebviewHtml(currentPanel.webview, context);

  function postFullState() {
    if (!currentPanel || !liveSyncService) return;
    currentPanel.webview.postMessage({
      type: "diagramListUpdate",
      diagrams: liveSyncService.listDiagramFiles(),
      diagramDetails: liveSyncService.listDiagramDetails(),
      activeDiagram: liveSyncService.activeFilename,
      workspaces: liveSyncService.getAvailableWorkspaces(),
      activeWorkspace: liveSyncService.getActiveWorkspaceInfo(),
    });
  }

  currentPanel.webview.onDidReceiveMessage(
    (msg: WebviewToHostMessage) => {
      switch (msg.type) {
        case "requestSync": {
          const plan = liveSyncService?.ensureInitialPlan();
          if (plan && currentPanel) {
            currentPanel.webview.postMessage({
              type: "syncPlan",
              plan,
            });
            postFullState();
          }
          break;
        }
        case "listDiagrams": {
          postFullState();
          break;
        }
        case "switchDiagram": {
          if (msg.filename && liveSyncService) {
            liveSyncService.setActiveFilename(msg.filename);
          }
          break;
        }
        case "switchWorkspace": {
          if (msg.workspacePath && liveSyncService) {
            liveSyncService.setActiveWorkspace(msg.workspacePath);
            postFullState();
            vscode.window.showInformationMessage(`AI Live Draw switched to workspace: ${path.basename(msg.workspacePath)}`);
          }
          break;
        }
        case "browseWorkspace": {
          const currentDir = liveSyncService?.activeWorkspacePath;
          const defaultUri = currentDir && fs.existsSync(currentDir)
            ? vscode.Uri.file(path.dirname(currentDir))
            : vscode.Uri.file("F:\\");

          vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri,
            openLabel: "Select Project / Workspace Folder",
          }).then((folders) => {
            if (folders && folders.length > 0 && liveSyncService && currentPanel) {
              const selectedPath = folders[0].fsPath;
              liveSyncService.setActiveWorkspace(selectedPath);
              postFullState();
              vscode.window.showInformationMessage(`AI Live Draw loaded workspace: ${path.basename(selectedPath)}`);
            }
          });
          break;
        }
        case "deleteDiagram": {
          if (msg.filename && liveSyncService) {
            const deleted = liveSyncService.deleteDiagram(msg.filename);
            if (deleted) {
              vscode.window.showInformationMessage(`Deleted diagram: ${msg.filename}`);
            }
          }
          break;
        }
        case "newDiagram": {
          if (msg.title && liveSyncService) {
            const plan = liveSyncService.createNewDiagram(msg.title);
            if (currentPanel) {
              currentPanel.webview.postMessage({
                type: "syncPlan",
                plan,
              });
              postFullState();
            }
          }
          break;
        }
        case "savePlan": {
          if (msg.plan && liveSyncService) {
            liveSyncService.writePlanToFile(msg.plan, msg.filename || liveSyncService.activeFilename);
          }
          break;
        }
        case "logActivity": {
          if (msg.activity && liveSyncService) {
            liveSyncService.logActivity(msg.activity);
          }
          break;
        }
      }
    },
    undefined,
    context.subscriptions
  );

  currentPanel.onDidDispose(
    () => {
      currentPanel = undefined;
    },
    undefined,
    context.subscriptions
  );
}

function getWebviewHtml(
  webview: vscode.Webview,
  context: vscode.ExtensionContext
): string {
  const distPath = path.join(context.extensionPath, "dist");
  const htmlPath = path.join(distPath, "index.html");

  let html = "";
  if (fs.existsSync(htmlPath)) {
    html = fs.readFileSync(htmlPath, "utf-8");
  } else {
    const srcHtml = path.join(context.extensionPath, "src", "webview", "index.html");
    html = fs.readFileSync(srcHtml, "utf-8");
  }

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(distPath, "webview.js"))
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(distPath, "style.css"))
  );

  html = html.replace('href="style.css"', `href="${styleUri}"`);
  html = html.replace('src="webview.js"', `src="${scriptUri}"`);

  return html;
}

export function deactivate() {
  liveSyncService?.dispose();
  currentPanel?.dispose();
}
