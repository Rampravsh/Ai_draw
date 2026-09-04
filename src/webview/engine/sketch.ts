// Procedural hand-drawn sketch rendering engine
// Emulates organic hand-drawn pen/pencil strokes with subtle double-pass jitter, corner overshoots, and clean minimalist sketch aesthetics.

import { ArrowRouting, FontFamily } from "../../types";

export interface StrokeOptions {
  strokeColor?: string;
  strokeWidth?: number;
  roughness?: number; // 0 (crisp) to 2 (extra sketchy)
  dash?: number[];
}

export class SketchRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  // Draw a hand-drawn line between (x1, y1) and (x2, y2)
  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    opts: StrokeOptions = {}
  ) {
    const {
      strokeColor = "#e4e4e7",
      strokeWidth = 1.8,
      roughness = 0.85,
      dash = [],
    } = opts;
    const ctx = this.ctx;

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (dash.length > 0) {
      ctx.setLineDash(dash);
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) {
      ctx.restore();
      return;
    }

    // Pass 1: Main stroke with slight mid-point bow
    this.drawJitterLine(x1, y1, x2, y2, roughness, 0);

    // Pass 2: Subtle secondary pencil stroke (unless dashed)
    if (dash.length === 0 && roughness > 0.4) {
      ctx.globalAlpha = 0.45;
      const overshoot = (Math.random() - 0.5) * 3 * roughness;
      this.drawJitterLine(
        x1 - (dx / dist) * overshoot,
        y1 - (dy / dist) * overshoot,
        x2 + (dx / dist) * overshoot,
        y2 + (dy / dist) * overshoot,
        roughness * 0.75,
        1
      );
    }

    ctx.restore();
  }

  private drawJitterLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    roughness: number,
    seed: number
  ) {
    const ctx = this.ctx;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);

    const segments = Math.max(2, Math.floor(dist / 40));
    const nx = -dy / dist;
    const ny = dx / dist;

    ctx.beginPath();
    ctx.moveTo(x1, y1);

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const jitterAmount =
        Math.sin(t * Math.PI) * (roughness * 1.3) * ((i % 2 === 0 ? 1 : -1) * (0.8 + 0.3 * Math.sin(seed + i)));
      const cx = px + nx * jitterAmount;
      const cy = py + ny * jitterAmount;
      ctx.lineTo(cx, cy);
    }

    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Draw hand-drawn rectangle with optional fill
  drawRect(
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor?: string,
    opts: StrokeOptions = {}
  ) {
    const ctx = this.ctx;

    if (fillColor && fillColor !== "transparent") {
      ctx.save();
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.fill();
      ctx.restore();
    }

    const r = opts.roughness ?? 0.85;
    const o = 2 * r;

    this.drawLine(x - o, y, x + w + o, y, opts);
    this.drawLine(x + w, y - o, x + w, y + h + o, opts);
    this.drawLine(x + w + o, y + h, x - o, y + h, opts);
    this.drawLine(x, y + h + o, x, y - o, opts);
  }

  // Draw sticky note with folded corner
  drawStickyNote(
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor: string = "#fef08a",
    opts: StrokeOptions = {}
  ) {
    const ctx = this.ctx;
    const fold = 18;

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - fold);
    ctx.lineTo(x + w - fold, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.beginPath();
    ctx.moveTo(x + w - fold, y + h);
    ctx.lineTo(x + w - fold, y + h - fold);
    ctx.lineTo(x + w, y + h - fold);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const r = opts.roughness ?? 0.85;
    this.drawLine(x, y, x + w, y, opts);
    this.drawLine(x + w, y, x + w, y + h - fold, opts);
    this.drawLine(x + w, y + h - fold, x + w - fold, y + h, opts);
    this.drawLine(x + w - fold, y + h, x, y + h, opts);
    this.drawLine(x, y + h, x, y, opts);
    this.drawLine(x + w - fold, y + h, x + w - fold, y + h - fold, { ...opts, roughness: r * 0.7 });
    this.drawLine(x + w - fold, y + h - fold, x + w, y + h - fold, { ...opts, roughness: r * 0.7 });
  }

  // Draw decision diamond
  drawDiamond(
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor?: string,
    opts: StrokeOptions = {}
  ) {
    const ctx = this.ctx;
    const mx = x + w / 2;
    const my = y + h / 2;

    if (fillColor && fillColor !== "transparent") {
      ctx.save();
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(mx, y);
      ctx.lineTo(x + w, my);
      ctx.lineTo(mx, y + h);
      ctx.lineTo(x, my);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const o = 2.5 * (opts.roughness ?? 0.85);
    this.drawLine(mx, y - o, x + w + o, my, opts);
    this.drawLine(x + w + o, my, mx, y + h + o, opts);
    this.drawLine(mx, y + h + o, x - o, my, opts);
    this.drawLine(x - o, my, mx, y - o, opts);
  }

  // Draw database cylinder
  drawCylinder(
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor?: string,
    opts: StrokeOptions = {}
  ) {
    const ctx = this.ctx;
    const ry = 14;

    if (fillColor && fillColor !== "transparent") {
      ctx.save();
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + ry, w / 2, ry, 0, 0, Math.PI * 2);
      ctx.rect(x, y + ry, w, h - 2 * ry);
      ctx.ellipse(x + w / 2, y + h - ry, w / 2, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.drawLine(x, y + ry, x, y + h - ry, opts);
    this.drawLine(x + w, y + ry, x + w, y + h - ry, opts);
    this.drawEllipse(x + w / 2, y + ry, w / 2, ry, opts);
    this.drawArc(x + w / 2, y + h - ry, w / 2, ry, 0, Math.PI, opts);
  }

  // Draw Cloud Shape
  drawCloud(
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor?: string,
    opts: StrokeOptions = {}
  ) {
    const ctx = this.ctx;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const numPuffs = 8;

    if (fillColor && fillColor !== "transparent") {
      ctx.save();
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      for (let i = 0; i < numPuffs; i++) {
        const angle = (i / numPuffs) * Math.PI * 2;
        const px = cx + (w * 0.35) * Math.cos(angle);
        const py = cy + (h * 0.32) * Math.sin(angle);
        ctx.ellipse(px, py, w * 0.22, h * 0.25, 0, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }

    for (let i = 0; i < numPuffs; i++) {
      const angle = (i / numPuffs) * Math.PI * 2;
      const px = cx + (w * 0.35) * Math.cos(angle);
      const py = cy + (h * 0.32) * Math.sin(angle);
      this.drawArc(px, py, w * 0.22, h * 0.25, angle - 0.7, angle + 0.7, opts);
    }
  }

  // Draw Capsule / Pill Shape
  drawCapsule(
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor?: string,
    opts: StrokeOptions = {}
  ) {
    const ctx = this.ctx;
    const r = Math.min(w, h) / 2;

    if (fillColor && fillColor !== "transparent") {
      ctx.save();
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      ctx.restore();
    }

    this.drawLine(x + r, y, x + w - r, y, opts);
    this.drawLine(x + r, y + h, x + w - r, y + h, opts);
    this.drawArc(x + w - r, y + r, r, r, -Math.PI / 2, Math.PI / 2, opts);
    this.drawArc(x + r, y + r, r, r, Math.PI / 2, (3 * Math.PI) / 2, opts);
  }

  // Draw Queue / Buffer Shape (Rectangle with internal vertical lines)
  drawQueue(
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor?: string,
    opts: StrokeOptions = {}
  ) {
    this.drawRect(x, y, w, h, fillColor, opts);
    const slots = 3;
    for (let i = 1; i <= slots; i++) {
      const sx = x + (w / (slots + 1)) * i;
      this.drawLine(sx, y, sx, y + h, { ...opts, dash: [4, 3] });
    }
  }

  // Draw Actor / Stick Figure
  drawActor(
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor?: string,
    opts: StrokeOptions = {}
  ) {
    const cx = x + w / 2;
    const headRadius = Math.min(w, h) * 0.18;
    const headY = y + headRadius + 4;
    const neckY = headY + headRadius;
    const waistY = y + h * 0.65;
    const feetY = y + h - 4;

    this.drawEllipse(cx, headY, headRadius, headRadius, opts);
    this.drawLine(cx, neckY, cx, waistY, opts);
    const armY = neckY + (waistY - neckY) * 0.35;
    this.drawLine(cx - w * 0.35, armY, cx + w * 0.35, armY, opts);
    this.drawLine(cx, waistY, cx - w * 0.3, feetY, opts);
    this.drawLine(cx, waistY, cx + w * 0.3, feetY, opts);
  }

  // Draw Circle Shape
  drawCircle(
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor?: string,
    opts: StrokeOptions = {}
  ) {
    const ctx = this.ctx;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) / 2;

    if (fillColor && fillColor !== "transparent") {
      ctx.save();
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.drawEllipse(cx, cy, r, r, opts);
  }

  // Hand-drawn ellipse
  drawEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    opts: StrokeOptions = {}
  ) {
    const ctx = this.ctx;
    const { strokeColor = "#e4e4e7", strokeWidth = 1.8, roughness = 0.85 } = opts;
    const points = 24;

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";

    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const jitter = (Math.sin(angle * 3) * 1.0 + (Math.random() - 0.5) * 1.2) * roughness;
      const px = cx + (rx + jitter) * Math.cos(angle);
      const py = cy + (ry + jitter) * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    if (roughness > 0.4) {
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      for (let i = 0; i <= points + 1; i++) {
        const angle = (i / points) * Math.PI * 2 + 0.1;
        const jitter = (Math.cos(angle * 2) * 0.9) * roughness;
        const px = cx + (rx + jitter) * Math.cos(angle);
        const py = cy + (ry + jitter) * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  // Hand-drawn Arc
  drawArc(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    startAngle: number,
    endAngle: number,
    opts: StrokeOptions = {}
  ) {
    const ctx = this.ctx;
    const { strokeColor = "#e4e4e7", strokeWidth = 1.8, roughness = 0.85 } = opts;
    const points = 16;

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";

    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const angle = startAngle + t * (endAngle - startAngle);
      const jitter = (Math.sin(t * Math.PI) * 1.0) * roughness;
      const px = cx + (rx + jitter) * Math.cos(angle);
      const py = cy + (ry + jitter) * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Bendable & Elbow Arrow rendering
  drawBendableArrow(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    label?: string,
    style: "solid" | "dashed" | "animated" = "solid",
    routing: ArrowRouting = "straight",
    color: string = "#94a3b8",
    animOffset: number = 0,
    fontFamily: FontFamily = "handwritten"
  ) {
    const ctx = this.ctx;
    const opts: StrokeOptions = {
      strokeColor: color,
      strokeWidth: 2,
      roughness: 0.85,
      dash: style === "dashed" ? [6, 4] : [],
    };

    let pathPoints: { x: number; y: number }[] = [];
    let endAngle = 0;
    let labelMidPoint = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };

    if (routing === "elbow") {
      // 90-degree orthogonal bend: go horizontal then vertical
      const midX = (x1 + x2) / 2;
      this.drawLine(x1, y1, midX, y1, opts);
      this.drawLine(midX, y1, midX, y2, opts);
      this.drawLine(midX, y2, x2, y2, opts);

      pathPoints = [
        { x: x1, y: y1 },
        { x: midX, y: y1 },
        { x: midX, y: y2 },
        { x: x2, y: y2 },
      ];
      endAngle = Math.atan2(0, x2 - midX);
      labelMidPoint = { x: midX, y: (y1 + y2) / 2 };
    } else if (routing === "curved") {
      // Smooth curved arc
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.hypot(dx, dy);

      // Arc apex deflection perpendicular to vector
      const deflection = Math.min(60, dist * 0.25);
      const nx = -dy / dist;
      const ny = dx / dist;
      const cx = mx + nx * deflection;
      const cy = my + ny * deflection;

      this.drawCurvedBezier(x1, y1, cx, cy, x2, y2, opts);
      pathPoints = [
        { x: x1, y: y1 },
        { x: cx, y: cy },
        { x: x2, y: y2 },
      ];
      endAngle = Math.atan2(y2 - cy, x2 - cx);
      labelMidPoint = { x: cx, y: cy };
    } else {
      // Straight
      this.drawLine(x1, y1, x2, y2, opts);
      pathPoints = [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ];
      endAngle = Math.atan2(y2 - y1, x2 - x1);
      labelMidPoint = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    }

    // Arrowhead
    const headLen = 14;
    const headAngle = Math.PI / 7;
    const leftX = x2 - headLen * Math.cos(endAngle - headAngle);
    const leftY = y2 - headLen * Math.sin(endAngle - headAngle);
    const rightX = x2 - headLen * Math.cos(endAngle + headAngle);
    const rightY = y2 - headLen * Math.sin(endAngle + headAngle);

    this.drawLine(x2, y2, leftX, leftY, { strokeColor: color, strokeWidth: 2.2, roughness: 0.7 });
    this.drawLine(x2, y2, rightX, rightY, { strokeColor: color, strokeWidth: 2.2, roughness: 0.7 });

    // Animated dots along the path
    if (style === "animated" && pathPoints.length >= 2) {
      this.drawAnimatedDotsAlongPath(pathPoints, color, animOffset);
    }

    // Arrow Label
    if (label && label.trim().length > 0) {
      this.drawArrowLabel(labelMidPoint.x, labelMidPoint.y, label, color, fontFamily);
    }
  }

  private drawCurvedBezier(
    x1: number,
    y1: number,
    cx: number,
    cy: number,
    x2: number,
    y2: number,
    opts: StrokeOptions
  ) {
    const ctx = this.ctx;
    const steps = 18;
    ctx.save();
    ctx.strokeStyle = opts.strokeColor || "#94a3b8";
    ctx.lineWidth = opts.strokeWidth || 2;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      // Quadratic bezier formula
      const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
      const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawAnimatedDotsAlongPath(
    points: { x: number; y: number }[],
    color: string,
    animOffset: number
  ) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;

    // Approximate total length
    let totalLen = 0;
    const segmentLens: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
      segmentLens.push(d);
      totalLen += d;
    }

    if (totalLen > 30) {
      const numDots = Math.floor(totalLen / 45);
      for (let i = 0; i < numDots; i++) {
        const targetDist = (((i / numDots + animOffset) % 1 + 1) % 1) * totalLen;
        let accum = 0;
        for (let s = 0; s < segmentLens.length; s++) {
          if (accum + segmentLens[s] >= targetDist) {
            const segT = (targetDist - accum) / segmentLens[s];
            const p1 = points[s];
            const p2 = points[s + 1];
            const px = p1.x + (p2.x - p1.x) * segT;
            const py = p1.y + (p2.y - p1.y) * segT;
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          accum += segmentLens[s];
        }
      }
    }
    ctx.restore();
  }

  private drawArrowLabel(
    mx: number,
    my: number,
    label: string,
    color: string,
    fontFamily: FontFamily
  ) {
    const ctx = this.ctx;
    ctx.save();
    const fontStr =
      fontFamily === "sans"
        ? "13px 'Inter', -apple-system, sans-serif"
        : "14px 'Shantell Sans', 'Patrick Hand', cursive, sans-serif";
    ctx.font = fontStr;

    const metrics = ctx.measureText(label);
    const textW = metrics.width;
    const pillW = textW + 14;
    const pillH = 22;

    const isDark = !ctx.canvas.classList.contains("theme-light");
    ctx.fillStyle = isDark ? "#18181b" : "#ffffff";
    ctx.fillRect(mx - pillW / 2, my - pillH / 2, pillW, pillH);

    this.drawRect(mx - pillW / 2, my - pillH / 2, pillW, pillH, undefined, {
      strokeColor: color,
      strokeWidth: 1.2,
      roughness: 0.5,
    });

    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, mx, my);
    ctx.restore();
  }

  // Draw clean text (supports Shantell Sans and clean Inter sans)
  drawText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number = 20,
    fontSize: number = 16,
    color: string = "#f4f4f5",
    weight: "normal" | "bold" = "normal",
    fontFamily: FontFamily = "handwritten"
  ): number {
    const ctx = this.ctx;
    ctx.save();

    const fontFace =
      fontFamily === "sans"
        ? "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        : "'Shantell Sans', 'Patrick Hand', cursive, sans-serif";

    ctx.font = `${weight === "bold" ? "600 " : "400 "}${fontSize}px ${fontFace}`;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const paragraphs = text.split("\n");
    let currentY = y;

    for (const para of paragraphs) {
      const words = para.split(" ");
      let currentLine = "";

      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine.length === 0 ? words[i] : currentLine + " " + words[i];
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth > maxWidth && currentLine.length > 0) {
          ctx.fillText(currentLine, x, currentY);
          currentLine = words[i];
          currentY += lineHeight;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine.length > 0) {
        ctx.fillText(currentLine, x, currentY);
        currentY += lineHeight;
      }
    }

    ctx.restore();
    return currentY;
  }
}
