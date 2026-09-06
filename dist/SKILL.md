---
name: ai-live-draw
description: Live-draws architecture diagrams, flowcharts, plans, and step-by-step progress visually onto the AI Live Draw whiteboard extension whenever conversing with the user in the IDE.
---

# AI Live Draw Workflow

Use this skill whenever the user asks to draw, visualize, plan, or explain system architecture, flowcharts, task roadmaps, or workflows.

## Critical Instructions (Zero Scanning & Zero Overhead)
- **Do NOT scan or search external directories** (never search for extension source code).
- The **AI Live Draw** extension is already installed in the IDE.
- In **ANY project or workspace**, to draw or update the canvas, simply write or update `.aidraw/plan.json` in the **CURRENT active workspace**.
- The extension's background file watcher will immediately detect `.aidraw/plan.json` and render it live on the whiteboard canvas beside the chat!

## Standard Drawing Format (`.aidraw/plan.json`)

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
      "id": "step-1",
      "type": "card",
      "width": 230,
      "height": 110,
      "title": "1. User / Client Layer",
      "text": "Frontend interface & user requests",
      "color": "blue",
      "status": "completed",
      "badge": "STEP 1"
    },
    {
      "id": "decision-1",
      "type": "decision",
      "width": 170,
      "height": 120,
      "title": "Authenticated?",
      "text": "Validate token or session",
      "color": "amber"
    },
    {
      "id": "step-2",
      "type": "card",
      "width": 230,
      "height": 110,
      "title": "2. Backend Service",
      "text": "Processes business logic & calls DB",
      "color": "green",
      "status": "active",
      "badge": "ACTIVE"
    },
    {
      "id": "db-1",
      "type": "database",
      "width": 180,
      "height": 120,
      "title": "Database Storage",
      "text": "PostgreSQL / MongoDB store",
      "color": "purple"
    },
    {
      "id": "note-1",
      "type": "sticky",
      "width": 200,
      "height": 140,
      "title": "💡 Important Note",
      "text": "• Sub-50ms latency\n• Automatic real-time live sync",
      "color": "yellow"
    }
  ],
  "edges": [
    {
      "from": "step-1",
      "to": "decision-1",
      "label": "HTTPS Request",
      "style": "animated"
    },
    {
      "from": "decision-1",
      "to": "step-2",
      "label": "Valid",
      "style": "animated"
    },
    {
      "from": "step-2",
      "to": "db-1",
      "label": "Query / Mutation",
      "style": "animated",
      "routing": "elbow"
    }
  ],
  "updatedAt": "2026-09-06T12:00:00.000Z"
}
```

## Node Types
- `card`: Process step or service box (colors: `blue`, `green`, `amber`, `purple`, `rose`, `default`).
- `decision`: Diamond branching node.
- `database`: Database cylinder for storage, Redis, or DB.
- `cloud`: Cloud cluster / Kubernetes / external network.
- `circle`: State node or round status indicator.
- `capsule`: Pill shape for API endpoints or events.
- `queue`: Message queue / task buffer (RabbitMQ / BullMQ / Kafka).
- `actor`: User / client stick figure.
- `sticky`: Post-it note with folded corner for tips or annotations.

## Status Markers
- `todo`, `active`, `completed`, `warning`, `error`

## Arrow Styles & Routing
- `style`: `"animated"` (moving pulse dots), `"solid"`, `"dashed"`
- `routing`: `"straight"` (direct), `"elbow"` (90° corner bend), `"curved"` (bezier arc)
