---
name: ai-live-draw
description: Live-draws architecture diagrams, flowcharts, plans, and step-by-step progress visually onto the AI Live Draw whiteboard extension whenever conversing with the user in the IDE.
---

# AI Live Draw — Complete Creative Freedom

Whenever the user asks you to explain, visualize, design, architect, or plan anything, **use AI Live Draw to sketch it visually!**

## 🌟 ZERO RESTRICTIONS — YOU HAVE 100% CREATIVE FREEDOM!
**You are NEVER restricted to a fixed list of shapes, arrows, or styles!**
Whatever shape, whatever arrow type, whatever vector design, whatever text or styling you need to clearly and beautifully explain your thoughts to the user — **YOU CAN CREATE IT!**

- **Any Shape You Need**: Use standard shapes, extended shapes, or invent ANY shape name you want! If you need a completely custom vector geometry, provide an `svgPath` (standard SVG path string) or polygon `points` `[[x, y], ...]`.
- **Any Arrow You Need**: Solid, dashed, dotted, animated pulse dots, neon glow, bidirectional (`arrowStart: true`), straight, curved, elbow, or custom routing with custom colors and labels.
- **Any Text & Icons**: Use any emojis (`⚡`, `🚀`, `🛡️`, `🌐`, `💻`, `🧠`, `💾`, etc.) via `icon`, multi-line descriptions via `text`, custom tags via `badge`, status indicators via `status`.
- **Any Colors**: Use any hex code (`#6366f1`, `#ec4899`, `#10b981`), RGB, HSL, or preset names (`blue`, `green`, `purple`, `amber`, `rose`, `yellow`). Set custom `customFill`, `customStroke`, `strokeWidth`, and `strokeStyle`.

---

## How to Draw (Zero Overhead)
- **Do NOT scan or search external folders.** The extension is already running in the IDE.
- Simply write or update `.aidraw/plan.json` (or any `.aidraw/<name>.json`) in the active workspace.
- The whiteboard canvas file watcher updates and animates in real time!

---

## Drawing Schema & Example

Write directly to `.aidraw/plan.json`:

```json
{
  "title": "System Architecture / Plan Title",
  "filename": "plan.json",
  "theme": "dark",
  "grid": "graph",
  "fontFamily": "handwritten",
  "layout": "manual",
  "nodes": [
    {
      "id": "client",
      "type": "browser",
      "x": 60,
      "y": 80,
      "width": 240,
      "height": 160,
      "icon": "🌐",
      "title": "Web Application",
      "text": "React 19 + Vite Frontend\nInteractive live canvas",
      "color": "purple",
      "status": "completed",
      "badge": "UI"
    },
    {
      "id": "cli-tool",
      "type": "terminal",
      "x": 60,
      "y": 300,
      "width": 240,
      "height": 150,
      "icon": "💻",
      "title": "Developer CLI",
      "text": "agy / npm run dev\nLocal automation scripts",
      "color": "default"
    },
    {
      "id": "gateway",
      "type": "shield",
      "x": 370,
      "y": 85,
      "width": 160,
      "height": 150,
      "icon": "🛡️",
      "title": "API Firewall",
      "text": "Rate limiting & OAuth2\nReverse proxy guard",
      "color": "green",
      "status": "active",
      "badge": "SECURITY"
    },
    {
      "id": "backend",
      "type": "server",
      "x": 600,
      "y": 80,
      "width": 210,
      "height": 155,
      "icon": "⚡",
      "title": "App Server Cluster",
      "text": "Node.js / Go microservices\nHigh-throughput async IO",
      "color": "blue",
      "status": "active"
    },
    {
      "id": "ai-engine",
      "type": "hexagon",
      "x": 880,
      "y": 85,
      "width": 190,
      "height": 145,
      "icon": "🧠",
      "title": "AI Inference Core",
      "text": "LLM agent reasoning\nDynamic diagram generation",
      "color": "amber",
      "status": "active",
      "badge": "AI"
    },
    {
      "id": "database",
      "type": "database",
      "x": 605,
      "y": 320,
      "width": 200,
      "height": 130,
      "icon": "💾",
      "title": "Database & Cache",
      "text": "PostgreSQL cluster + Redis\nPersistent storage",
      "color": "purple"
    },
    {
      "id": "custom-shape-example",
      "type": "custom",
      "x": 880,
      "y": 310,
      "width": 190,
      "height": 150,
      "icon": "✨",
      "title": "Freeform SVG Shape",
      "text": "Arbitrary vector geometry\nHand-drawn sketch style",
      "svgPath": "M 20 20 L 170 20 L 180 80 L 170 140 L 20 140 L 10 80 Z",
      "customFill": "#1e1b4b",
      "customStroke": "#818cf8"
    }
  ],
  "edges": [
    {
      "from": "client",
      "to": "gateway",
      "label": "HTTPS REST / WSS",
      "style": "animated",
      "routing": "straight"
    },
    {
      "from": "cli-tool",
      "to": "gateway",
      "label": "gRPC / IPC",
      "style": "dashed",
      "routing": "curved"
    },
    {
      "from": "gateway",
      "to": "backend",
      "label": "Authenticated",
      "style": "animated",
      "routing": "straight"
    },
    {
      "from": "backend",
      "to": "ai-engine",
      "label": "Task Dispatch",
      "style": "neon",
      "routing": "straight"
    },
    {
      "from": "backend",
      "to": "database",
      "label": "Queries / Mutations",
      "style": "animated",
      "routing": "elbow",
      "bidirectional": true
    }
  ],
  "updatedAt": "2026-09-06T20:30:00.000Z"
}
```

---

## Inspiration Guide (Use Any of These or Invent Your Own!)

### Shapes You Can Use or Create:
- **Built-in shapes**: `card`, `server`, `browser`, `terminal`, `shield`, `hexagon`, `database`, `cloud`, `queue`, `actor`, `mobile`, `folder`, `circle`, `capsule`, `decision`, `triangle`, `parallelogram`, `trapezoid`, `sticky`, `text`.
- **Friendly aliases supported automatically**: `db`, `disk`, `storage`, `k8s`, `kubernetes`, `cluster`, `network`, `firewall`, `security`, `auth`, `web`, `ui`, `frontend`, `phone`, `app`, `user`, `person`, `client`, `console`, `cli`, `bash`, `rack`, `host`, `backend`, `diamond`, `condition`, `pill`, `endpoint`, `stream`, `kafka`, `package`, `directory`, `module`.
- **Arbitrary Custom Shapes**: If you want a shape that doesn't exist, just provide `svgPath` (any SVG path string) or `points` (polygon coordinates), or use any name you like and the engine will gracefully draw it with your custom styles!

### Arrow Styles You Can Use:
- `style`: `"animated"` (live energy particle dots), `"solid"`, `"dashed"`, `"dotted"`, `"neon"` (glowing stroke).
- `routing`: `"straight"` (direct point-to-point), `"elbow"` (clean right-angle 90° bends), `"curved"` (smooth bezier arc).
- `bidirectional`: `true` (or `arrowStart: true`) for two-way or request-response flows.
- `strokeWidth`: Any thickness (e.g. `1.5`, `2`, `3`, `4`).
- `color`: Any color or preset name.
- `label`: Any descriptive text along the arrow.

### Creative Freedom Tip:
Always make diagrams informative, clear, colorful, and alive. Use icons (`icon`), badges (`badge`), and statuses (`status: "completed" | "active" | "todo" | "warning" | "error"`) to make your architecture and plans engaging!
