---
name: ai-live-draw
description: Live-draws architecture diagrams, flowcharts, plans, and step-by-step progress visually onto the AI Live Draw whiteboard extension whenever conversing with the user in the IDE.
---

# AI Live Draw Workflow

Use this skill whenever you are discussing a plan, explaining system architecture, breaking down tasks, or working on complex workflows with the user.

## Purpose
The user has the **AI Live Draw** extension open in their IDE (in a side editor column beside the chat). Whenever you update `.aidraw/plan.json`, the canvas immediately reflects your changes live on a minimalist hand-drawn graph paper canvas with animated connectors!

## How to Live-Draw

### Option 1: Direct JSON Update (Recommended for batch diagrams)
Write or modify `.aidraw/plan.json` directly. The file schema:

```json
{
  "title": "Authentication Architecture & Flow",
  "theme": "dark",
  "grid": "graph",
  "layout": "auto",
  "nodes": [
    {
      "id": "step-1",
      "type": "card",
      "width": 220,
      "height": 100,
      "title": "1. User Login Request",
      "text": "POST /api/auth/login with credentials",
      "color": "blue",
      "status": "completed"
    },
    {
      "id": "step-2",
      "type": "card",
      "width": 220,
      "height": 100,
      "title": "2. Verify Password Hash",
      "text": "bcrypt.compare against Postgres DB",
      "color": "green",
      "status": "active"
    },
    {
      "id": "db-1",
      "type": "database",
      "width": 160,
      "height": 110,
      "title": "Postgres DB",
      "text": "Users table",
      "color": "purple"
    }
  ],
  "edges": [
    {
      "from": "step-1",
      "to": "step-2",
      "label": "payload",
      "style": "animated"
    },
    {
      "from": "step-2",
      "to": "db-1",
      "label": "SELECT user",
      "style": "solid"
    }
  ]
}
```

### Option 2: CLI Commands
Run commands in terminal:
```bash
# Add a new step
node .aidraw/draw.js add-step --id step-3 --title "3. Issue JWT Token" --text "Sign access & refresh tokens" --color amber --status todo

# Connect steps with animated data flow
node .aidraw/draw.js connect step-2 step-3 --label "on success" --style animated

# Mark an active step completed
node .aidraw/draw.js set-status step-2 completed
node .aidraw/draw.js set-status step-3 active

# Add a sticky note tip
node .aidraw/draw.js add-sticky --title "Note" --text "Use 15m expiration for access tokens"
```

## Node Types
- `card`: Standard step or component (colors: `blue`, `green`, `amber`, `purple`, `rose`, `default`).
- `decision`: Diamond branching node (e.g. "Is Token Valid?").
- `database`: Database cylinder for DB, cache, or storage.
- `sticky`: Post-it style sticky note with folded corner.

## Status Markers
- `todo`: Gray neutral badge
- `active`: Highlighted blue badge + thicker stroke (currently in progress)
- `completed`: Green check badge (finished)
- `warning`: Amber alert badge
- `error`: Red error badge

Always maintain `.aidraw/plan.json` during the conversation so the user can visually follow along with zero mental friction!
