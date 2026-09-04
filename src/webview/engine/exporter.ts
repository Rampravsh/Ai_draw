import { CanvasPlan } from "../../types";
import { LiveCanvas } from "./canvas";

export class CanvasExporter {
  // Export canvas as PNG image download
  public static exportToPng(liveCanvas: LiveCanvas, filename: string = "ai-plan.png") {
    const { canvas, plan } = liveCanvas;
    if (plan.nodes.length === 0) return;

    // Calculate bounds with padding
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of plan.nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }

    const padding = 60;
    const exportW = Math.ceil(maxX - minX + padding * 2);
    const exportH = Math.ceil(maxY - minY + padding * 2);

    // Create offscreen canvas for crisp rendering
    const offscreen = document.createElement("canvas");
    offscreen.width = exportW * 2; // 2x retina
    offscreen.height = exportH * 2;

    const offCtx = offscreen.getContext("2d")!;
    offCtx.scale(2, 2);

    // Render background
    const isDark = liveCanvas.theme === "dark";
    offCtx.fillStyle = isDark ? "#121215" : "#fbfbfe";
    offCtx.fillRect(0, 0, exportW, exportH);

    // Save temporary canvas transform
    const savedPanX = liveCanvas.panX;
    const savedPanY = liveCanvas.panY;
    const savedZoom = liveCanvas.zoom;

    // Direct render onto offscreen canvas
    const tempLive = new LiveCanvas(offscreen);
    tempLive.theme = liveCanvas.theme;
    tempLive.grid = liveCanvas.grid;
    tempLive.panX = padding - minX;
    tempLive.panY = padding - minY;
    tempLive.zoom = 1.0;
    tempLive.plan = plan;
    tempLive.render();
    tempLive.destroy();

    // Trigger download
    const dataUrl = offscreen.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }
}
