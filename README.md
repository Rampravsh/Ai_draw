# AI Live Draw ✏️

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open Source Love](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/)
[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](https://github.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/)

> **A minimalist, hand-drawn live visual canvas & architecture whiteboard extension for Antigravity IDE and VS Code.**  
> Designed to live-draw diagrams, system architectures, workflows, and step-by-step plans in real time as you chat with your AI assistant.

---

## 👨‍💻 Developer & Creator

- **Lead Developer & Creator**: **Rampravesh**  
- **Email**: [rampraveshkr4545@gmail.com](mailto:rampraveshkr4545@gmail.com)  
- **Project Type**: 100% Free & Open Source  

---

## 🌟 Why AI Live Draw?

When collaborating with AI agents in modern IDEs, text-only explanations can be overwhelming. **AI Live Draw** bridges this gap by providing an infinite sketch whiteboard right inside the IDE, side-by-side with your code or AI chat.

Whenever you discuss an architecture, data pipeline, task roadmap, or concept with the AI assistant, the extension automatically visualizes the plan live on an authentic, distraction-free hand-drawn canvas!

---

## ✨ Key Features

### 1. ⚡ 100% From-Scratch & Ultra-Lightweight (Zero Bloat)
- Built entirely from scratch using native HTML5 Canvas, Vanilla CSS, and TypeScript.
- **Zero heavy external dependencies**: No Excalidraw npm bloat, no heavy React runtime, no WebAssembly binaries.
- Entire webview bundle is only **~22 KB**—loads instantly with zero lag.

### 2. 🔄 Real-Time Live AI Conversation Sync
- Watches `.aidraw/plan.json` in your workspace.
- When the AI assistant (or you) updates the plan during conversation, the canvas smoothly reflects changes in real time.
- **Viewport Preservation**: Updates do NOT shift or jerk your viewport—your zoom level and pan position stay exactly where you are looking.

### 3. 📐 Engineering Graph Paper & Dark/Light Modes
- **Math/Engineering Graph Paper Grid**: Subtle major and minor grid lines that zoom and pan smoothly.
- **Grid Modes**: Switch between **▦ Graph**, **⁝ Dots**, and **◻ Blank** paper anytime.
- **Theme Switcher**: Instant toggle between **🌙 Dark Mode** (slate charcoal with chalk accents) and **☀️ Light Mode** (crisp blueprint paper).

### 4. ✍️ Clean Typography: Shantell Sans & Inter
- **Shantell Sans**: Clean, ultra-legible hand-drawn font that gives cards and sticky notes an authentic human sketch aesthetic without sacrificing readability.
- **Inter Clean Sans**: Crisp, modern sans-serif alternative.
- Toggle fonts globally across the whiteboard or customize per-node.

### 5. 🎨 9 Hand-Drawn Shapes in Right Sidebar
Conveniently located in the right sidebar palette:
1. **Step Card / Box** (`card`): Process steps with status badges (`TODO`, `ACTIVE`, `DONE`).
2. **Decision Diamond** (`decision`): Branching logic and conditional checkpoints.
3. **Sticky Note** (`sticky`): Organic post-it notes with folded corners.
4. **Database Cylinder** (`database`): Relational databases, caches, and storage.
5. **Cloud / Cluster** (`cloud`): Cloud infrastructure, Kubernetes clusters, and networks.
6. **Circle Node** (`circle`): States and round nodes.
7. **Capsule Pill** (`capsule`): API endpoints and microservice triggers.
8. **Message Queue** (`queue`): Task buffers with internal slot dividers.
9. **User / Actor** (`actor`): Stick-figure client / user representation.

### 6. 🔀 Bendable & 90° Elbow Arrows
- Connectors can take 90° orthogonal elbow bends or smooth curved Bezier arcs.
- Turns around obstacles cleanly.
- Animated moving pulse dots along connectors illustrate live data pipelines in real time.

### 7. 📝 Direct On-Node In-Place Text Editing
- **No clumsy popups or modal form boxes!**
- Double-click any card or note to edit text directly on the canvas.
- Full native mouse selection, backspace deletion, and typing.
- Press `Escape` or click away to auto-commit and save.

### 8. ↔️ Dynamic 4-Corner Resizing Handles
- Selecting any node reveals **4 corner resize handles**.
- Click and drag any corner to dynamically stretch, widen, or shrink the box.
- Dynamic auto-fit ensures long text never spills outside the boundaries.

### 9. 🖱️ Drag-and-Drop & Instant Morphing
- **Drag from Sidebar**: Drag any shape from the right sidebar palette directly onto the canvas at your exact drop location.
- **1-Click Morph**: Select an existing node and click any shape in the palette—it immediately morphs into that shape!
- **Smooth Moving**: Moving existing nodes is backed by `setPointerCapture` for rock-solid dragging.

### 10. ↶ Full Undo & Redo History
- Accidental delete or edit? Press **`Ctrl + Z`** to immediately restore your elements!
- Redo anytime with **`Ctrl + Y`** or **`Ctrl + Shift + Z`**.

### 11. 📁 Multi-Diagram & Multi-File Support
- Each project has its own isolated `.aidraw/` directory.
- Create multiple separate diagrams (e.g. `architecture.json`, `auth-flow.json`, `roadmap.json`).
- Switch or delete diagram files with 1 click directly in the sidebar **Diagrams** tab.

### 12. ▲ Collapsible Toolbar
- Click **`▲`** in the top-right corner to hide the top toolbar for a distraction-free full-canvas experience.
- Click the floating **`▼`** button to reveal it again.

---

## 🚀 Getting Started

### Installation & Launching in IDE
1. Open Antigravity IDE or VS Code.
2. Press `Ctrl + Shift + P` (or `F1`) and type:
   ```
   AI Draw: Open Live Visual Canvas
   ```
   *OR* click the **`$(paintcan) AI Live Draw`** button in the bottom-right status bar.
3. The visual whiteboard opens in the side editor column, right beside your AI chat or code editor!

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `V` | Select / Move / Resize Tool |
| `H` or `Space + Drag` | Pan Viewport Tool |
| `A` | Connect Arrow Tool |
| `E` | Eraser Tool |
| `Double Click` on node | Direct In-Place Text Edit |
| `Drag Corner Handle` | Resize Node Width & Height |
| `Ctrl + Z` | Undo last action |
| `Ctrl + Y` | Redo |
| `Delete` / `Backspace` | Delete selected node (Undoable) |
| `Ctrl + 0` | Reset Zoom to 100% |
| `Mouse Wheel` | Pan (Hold `Ctrl` to Zoom) |
| `▲` / `▼` | Hide / Show Top Toolbar |
| `⚙ Panel` | Toggle Right Sidebar |

---

## 🤖 Programmatic AI / CLI Usage

AI agents and developers can manipulate the live canvas from the terminal using `.aidraw/draw.js`:

```bash
# Initialize a new plan
node .aidraw/draw.js init "Microservices Architecture"

# Add a process step card
node .aidraw/draw.js add-step --id auth --title "1. Auth Service" --text "Verifies JWT tokens" --color blue --status completed

# Add a database cylinder
node .aidraw/draw.js add-node --id db --type database --title "PostgreSQL 16" --text "Users & Sessions" --color purple

# Connect nodes with elbow routing & animated data-flow
node .aidraw/draw.js connect auth db --label "queries" --style animated --routing elbow

# Add a sticky note
node .aidraw/draw.js add-sticky --title "Note" --text "Remember 15min JWT expiry" --color yellow

# Update status
node .aidraw/draw.js set-status auth completed

# Switch font or theme
node .aidraw/draw.js font handwritten
node .aidraw/draw.js theme dark
node .aidraw/draw.js grid graph
```

---

## 🤝 Contributing

**AI Live Draw is an open-source project, and anyone is welcome to contribute!**

We welcome bug reports, feature requests, design enhancements, and pull requests.

### How to Contribute:
1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/Ai_draw.git
   cd Ai_draw
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```
5. **Build and test**:
   ```bash
   npm run build
   ```
6. **Commit your changes**:
   ```bash
   git commit -m "feat: add amazing feature"
   ```
7. **Push to your branch**:
   ```bash
   git push origin feature/amazing-feature
   ```
8. **Open a Pull Request** describing your improvements.

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

Developed with ❤️ by **[Rampravesh](mailto:rampraveshkr4545@gmail.com)**.
