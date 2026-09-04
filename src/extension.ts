import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { LiveSyncService } from "./liveSync";
import { CanvasPlan, HostToWebviewMessage, WebviewToHostMessage } from "./types";

let currentPanel: vscode.WebviewPanel | undefined = undefined;
let liveSyncService: LiveSyncService | undefined = undefined;
let statusBarItem: vscode.StatusBarItem | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
  liveSyncService = new LiveSyncService();

  // Create Status Bar Item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "aiDraw.openCanvas";
  statusBarItem.text = "$(paintcan) AI Live Draw";
  statusBarItem.tooltip = "Open AI Live Visual Canvas (Graph Whiteboard)";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // When active plan changes, push live update to Webview
  liveSyncService.setOnPlanUpdated((plan: CanvasPlan) => {
    if (currentPanel) {
      currentPanel.webview.postMessage({
        type: "syncPlan",
        plan,
      });
      // Also update diagram list
      currentPanel.webview.postMessage({
        type: "diagramListUpdate",
        diagrams: liveSyncService?.listDiagramFiles(),
        activeDiagram: liveSyncService?.activeFilename,
      });
    }
  });

  liveSyncService.setOnDiagramListChanged((files: string[]) => {
    if (currentPanel) {
      currentPanel.webview.postMessage({
        type: "diagramListUpdate",
        diagrams: files,
        activeDiagram: liveSyncService?.activeFilename,
      });
    }
  });

  // Command: Open Live Canvas
  const openCanvasCmd = vscode.commands.registerCommand(
    "aiDraw.openCanvas",
    () => {
      openLiveCanvasPanel(context);
    }
  );

  // Command: Initialize New Plan
  const newPlanCmd = vscode.commands.registerCommand(
    "aiDraw.newDiagram",
    async () => {
      const title = await vscode.window.showInputBox({
        prompt: "Enter a title for the new visual plan",
        placeHolder: "e.g. Microservices Architecture",
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

  context.subscriptions.push(
    openCanvasCmd,
    newPlanCmd,
    clearCanvasCmd,
    toggleSyncCmd
  );
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
            currentPanel.webview.postMessage({
              type: "diagramListUpdate",
              diagrams: liveSyncService?.listDiagramFiles(),
              activeDiagram: liveSyncService?.activeFilename,
            });
          }
          break;
        }
        case "listDiagrams": {
          if (currentPanel && liveSyncService) {
            currentPanel.webview.postMessage({
              type: "diagramListUpdate",
              diagrams: liveSyncService.listDiagramFiles(),
              activeDiagram: liveSyncService.activeFilename,
            });
          }
          break;
        }
        case "switchDiagram": {
          if (msg.filename && liveSyncService) {
            liveSyncService.setActiveFilename(msg.filename);
          }
          break;
        }
        case "deleteDiagram": {
          if (msg.filename && liveSyncService) {
            liveSyncService.deleteDiagram(msg.filename);
            vscode.window.showInformationMessage(`Deleted diagram: ${msg.filename}`);
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
