#!/usr/bin/env node

/**
 * AI Live Draw Helper CLI
 * Enables AI agents and developers to programmatically update the live visual whiteboard.
 * 
 * Usage:
 *   node .aidraw/draw.js init "System Architecture"
 *   node .aidraw/draw.js add-node --id auth --title "Auth Service" --text "Validates JWT tokens" --color blue --status active
 *   node .aidraw/draw.js add-node --id db --type database --title "Postgres DB" --color purple
 *   node .aidraw/draw.js add-node --id cluster --type cloud --title "K8s Cluster" --color purple
 *   node .aidraw/draw.js add-node --id queue --type queue --title "Job Queue" --color rose
 *   node .aidraw/draw.js add-node --id user --type actor --title "Customer"
 *   node .aidraw/draw.js connect auth db --label "queries" --style animated --routing elbow
 *   node .aidraw/draw.js set-status auth completed
 *   node .aidraw/draw.js font [handwritten|sans]
 *   node .aidraw/draw.js theme [dark|light]
 *   node .aidraw/draw.js grid [graph|dots|blank]
 */

const fs = require("fs");
const path = require("path");

const PLAN_PATH = path.join(process.cwd(), ".aidraw", "plan.json");

function loadPlan() {
  if (!fs.existsSync(PLAN_PATH)) {
    return {
      title: "AI Live Plan",
      theme: "dark",
      grid: "graph",
      fontFamily: "handwritten",
      layout: "auto",
      nodes: [],
      edges: [],
      updatedAt: new Date().toISOString(),
    };
  }
  try {
    return JSON.parse(fs.readFileSync(PLAN_PATH, "utf-8"));
  } catch (e) {
    return {
      title: "AI Live Plan",
      theme: "dark",
      grid: "graph",
      fontFamily: "handwritten",
      layout: "auto",
      nodes: [],
      edges: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

function savePlan(plan) {
  const dir = path.dirname(PLAN_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  plan.updatedAt = new Date().toISOString();
  fs.writeFileSync(PLAN_PATH, JSON.stringify(plan, null, 2), "utf-8");
  console.log(`[AI Draw] Updated ${PLAN_PATH} (${plan.nodes.length} nodes, ${plan.edges?.length || 0} edges)`);
}

function parseArgs(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

const [, , cmd, ...rawArgs] = process.argv;
const { flags, positional } = parseArgs(rawArgs);

switch (cmd) {
  case "init": {
    const title = positional[0] || flags.title || "Project Plan & Architecture";
    const plan = {
      title,
      theme: flags.theme || "dark",
      grid: flags.grid || "graph",
      fontFamily: flags.font || "handwritten",
      layout: "auto",
      nodes: [],
      edges: [],
    };
    savePlan(plan);
    break;
  }

  case "add-node":
  case "add-step": {
    const plan = loadPlan();
    const id = flags.id || `node-${Date.now()}`;
    const type = flags.type || (cmd === "add-step" ? "card" : "card");
    const title = flags.title || positional[0] || "New Step";
    const text = flags.text || flags.desc || positional[1] || "";
    const color = flags.color || "default";
    const status = flags.status || (type === "card" ? "active" : "none");

    let width = parseInt(flags.w) || 220;
    let height = parseInt(flags.h) || 105;

    if (type === "sticky") { width = 170; height = 130; }
    else if (type === "cloud") { width = 220; height = 120; }
    else if (type === "actor") { width = 90; height = 130; }
    else if (type === "queue") { width = 180; height = 80; }
    else if (type === "circle") { width = 110; height = 110; }
    else if (type === "capsule") { width = 180; height = 60; }

    plan.nodes = plan.nodes.filter((n) => n.id !== id);

    plan.nodes.push({
      id,
      type,
      x: parseInt(flags.x) || 0,
      y: parseInt(flags.y) || 0,
      width,
      height,
      title,
      text,
      color,
      status,
      badge: flags.badge,
    });

    savePlan(plan);
    break;
  }

  case "connect": {
    const plan = loadPlan();
    const from = positional[0] || flags.from;
    const to = positional[1] || flags.to;
    if (!from || !to) {
      console.error("Usage: node .aidraw/draw.js connect <from-id> <to-id> [--label ...] [--routing straight|curved|elbow]");
      process.exit(1);
    }

    if (!plan.edges) plan.edges = [];
    plan.edges.push({
      from,
      to,
      label: flags.label || positional[2] || "",
      style: flags.style || "animated",
      routing: flags.routing || "straight",
      color: flags.color,
    });

    savePlan(plan);
    break;
  }

  case "set-status": {
    const plan = loadPlan();
    const id = positional[0] || flags.id;
    const status = positional[1] || flags.status || "completed";
    const node = plan.nodes.find((n) => n.id === id);
    if (!node) {
      console.error(`Node not found: ${id}`);
      process.exit(1);
    }
    node.status = status;
    savePlan(plan);
    break;
  }

  case "font": {
    const plan = loadPlan();
    plan.fontFamily = positional[0] || flags.font || "handwritten";
    savePlan(plan);
    break;
  }

  case "theme": {
    const plan = loadPlan();
    plan.theme = positional[0] || flags.theme || "dark";
    savePlan(plan);
    break;
  }

  case "grid": {
    const plan = loadPlan();
    plan.grid = positional[0] || flags.grid || "graph";
    savePlan(plan);
    break;
  }

  case "clear": {
    const plan = loadPlan();
    plan.nodes = [];
    plan.edges = [];
    savePlan(plan);
    break;
  }

  default:
    console.log(`
AI Live Draw CLI
Commands:
  init [title]
  add-step --title ... --text ...
  add-node --type [card|decision|sticky|database|cloud|circle|capsule|queue|actor] --title ...
  connect <from> <to> [--label ...] [--routing straight|curved|elbow]
  set-status <id> <todo|active|completed|warning|error>
  font [handwritten|sans]
  theme [dark|light]
  grid [graph|dots|blank]
  clear
`);
    break;
}
