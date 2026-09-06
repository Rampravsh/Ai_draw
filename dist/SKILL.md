---
name: ai-live-draw
description: Live-draws architecture diagrams, flowcharts, plans, and step-by-step progress visually onto the AI Live Draw whiteboard extension whenever conversing with the user in the IDE.
---

# AI Live Draw Workflow

Use this skill whenever the user asks to draw, visualize, plan, or explain system architecture, flowcharts, task roadmaps, designs, or workflows.

## Critical Instructions (Zero Overhead)
- **Do NOT scan external directories or search for extension code.**
- The **AI Live Draw** extension is already active in the IDE.
- To draw or update the canvas, simply write or edit `.aidraw/plan.json` (or any `.aidraw/<name>.json`) in the **CURRENT active workspace**.
- The extension's real-time file watcher will immediately detect the file and smoothly render it on the live whiteboard canvas.

---

## Architecture Diagram Specification (`.aidraw/plan.json`)

Write directly to `.aidraw/plan.json`:

```json
{
  "title": "System Architecture / Plan Title",
  "filename": "plan.json",
  "theme": "dark",
  "grid": "graph",
  "fontFamily": "handwritten",
  "layout": "auto",
  "nodes": [
    {
      "id": "client-web",
      "type": "browser",
      "x": 60,
      "y": 100,
      "width": 240,
      "height": 160,
      "icon": "🌐",
      "title": "Web Dashboard",
      "text": "React 19 + Tailwind SPA\nLive Canvas Engine",
      "color": "purple",
      "status": "completed",
      "badge": "CLIENT"
    },
    {
      "id": "gateway-shield",
      "type": "shield",
      "x": 360,
      "y": 105,
      "width": 160,
      "height": 150,
      "icon": "🛡️",
      "title": "API Firewall",
      "text": "OAuth2 / JWT Auth\nRate Limiting & WAF",
      "color": "green",
      "status": "active",
      "badge": "SECURITY"
    },
    {
      "id": "server-api",
      "type": "server",
      "x": 580,
      "y": 100,
      "width": 220,
      "height": 160,
      "icon": "⚡",
      "title": "Core API Gateway",
      "text": "Go / Node Cluster\nWebSocket Realtime Stream",
      "color": "blue",
      "status": "active"
    },
    {
      "id": "service-worker",
      "type": "hexagon",
      "x": 860,
      "y": 110,
      "width": 180,
      "height": 140,
      "icon": "⚙️",
      "title": "Worker Engine",
      "text": "Async Event Consumer\nBackground Sync Pipeline",
      "color": "amber",
      "status": "todo"
    },
    {
      "id": "db-storage",
      "type": "database",
      "x": 590,
      "y": 340,
      "width": 200,
      "height": 130,
      "icon": "💾",
      "title": "PostgreSQL DB",
      "text": "Primary Sharded Cluster\nRead Replicas & Cache",
      "color": "purple"
    }
  ],
  "edges": [
    {
      "from": "client-web",
      "to": "gateway-shield",
      "label": "HTTPS REST / WSS",
      "style": "animated",
      "routing": "straight"
    },
    {
      "from": "gateway-shield",
      "to": "server-api",
      "label": "Verified Token",
      "style": "animated",
      "routing": "straight"
    },
    {
      "from": "server-api",
      "to": "service-worker",
      "label": "Enqueue Job",
      "style": "animated",
      "routing": "straight"
    },
    {
      "from": "server-api",
      "to": "db-storage",
      "label": "Queries / Mutations",
      "style": "animated",
      "routing": "elbow"
    }
  ],
  "updatedAt": "2026-09-06T12:00:00.000Z"
}
```

---

## Node Types Reference

### 1. Standard Shapes
- `card`: Standard process card / service box.
- `decision`: Diamond branching node for conditionals and gates.
- `database`: Database cylinder storage.
- `cloud`: Cloud cluster / Kubernetes / external services.
- `circle`: State machine circle, status bubble, or event start/end.
- `capsule`: Pill shape for API endpoints, HTTP routes, or micro-actions.
- `queue`: Message queue / task buffer with divider lines (RabbitMQ, Redis, Kafka).
- `actor`: User stick figure representing humans, clients, or operators.
- `sticky`: Hand-drawn sticky post-it note with folded corner.
- `text`: Plain floating label or annotation without boundary.

### 2. Extended Architecture Shapes
- `hexagon`: Hexagonal microservice, orchestrator, or domain entity.
- `server`: Server rack enclosure with LED blink status indicators.
- `browser`: Web browser desktop application mockup with traffic light controls.
- `mobile`: Smartphone device enclosure with camera notch and home bar.
- `folder`: Directory module, code package, or component library.
- `shield`: Security firewall, authorization barrier, or compliance gateway.
- `triangle`: Warning, critical risk, or delta indicator.
- `parallelogram`: Data input/output streams, file feeds.
- `trapezoid`: Manual operation, transformation filter, or pipeline step.

### 3. AI Custom Shapes & Vector Graphics (Infinite Possibilities!)
You can create ANY arbitrary custom geometric design using:
- **`svgPath`**: SVG path command string (e.g. `"M 0 50 L 50 0 L 150 0 L 200 50 L 150 100 L 50 100 Z"`). Renders natively with hand-drawn styling and transforms to the node's `x, y` position!
- **`points`**: Array of polygon coordinate pairs `[[x1, y1], [x2, y2], ...]` or `[{x: x1, y: y1}, ...]` relative to the node.

---

## Custom Styling & Node Attributes

- **`icon`**: An emoji or symbol (e.g. `"⚡"`, `"🔒"`, `"💻"`, `"🌐"`, `"📱"`, `"🛡️"`, `"🚀"`, `"🧠"`, `"💾"`) rendered in the title bar.
- **`color`**: Preset theme (`"blue"`, `"green"`, `"amber"`, `"purple"`, `"rose"`, `"yellow"`, `"default"`) OR any custom hex/rgb code (`"#3b82f6"`, `"#10b981"`).
- **`customFill`**: Specific background fill color string (e.g. `"#1e1b4b"`, `"rgba(99, 102, 241, 0.15)"`).
- **`customStroke`**: Specific outline/stroke color string (e.g. `"#6366f1"`).
- **`strokeWidth`**: Line thickness (e.g. `1`, `2`, `3`).
- **`strokeStyle`**: `"solid"`, `"dashed"`, or `"dotted"`.
- **`status`**: `"todo"`, `"active"`, `"completed"`, `"warning"`, `"error"`, or `"none"`.
- **`badge`**: Custom pill text at top-right (e.g. `"STEP 1"`, `"PORT 3000"`, `"V2"`).

---

## Arrow Styles & Routing

- **`style`**:
  - `"animated"`: Flowing particles/energy dots along the arrow path (great for live processes!).
  - `"solid"`: Continuous hand-drawn line.
  - `"dashed"`: Dashed connector.
- **`routing`**:
  - `"elbow"`: Clean 90-degree orthogonal bends (best for architecture diagrams).
  - `"curved"`: Smooth quadratic bezier curve.
  - `"straight"`: Direct point-to-point line.
- **`label`**: Contextual label rendered along the arrow midpoint.
