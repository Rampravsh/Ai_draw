import { CanvasNode, CanvasEdge } from "../../types";

export interface LayoutOptions {
  direction?: "LR" | "TB"; // Left-to-Right or Top-to-Bottom
  nodeSpacingX?: number;
  nodeSpacingY?: number;
  startX?: number;
  startY?: number;
}

export function autoLayoutNodes(
  nodes: CanvasNode[],
  edges: CanvasEdge[] = [],
  options: LayoutOptions = {}
): CanvasNode[] {
  if (nodes.length === 0) return [];

  const {
    direction = "LR",
    nodeSpacingX = 80,
    nodeSpacingY = 70,
    startX = 100,
    startY = 140,
  } = options;

  // Build adjacency list and in-degree map
  const inDegree = new Map<string, number>();
  const childrenMap = new Map<string, string[]>();
  const nodeMap = new Map<string, CanvasNode>();

  for (const n of nodes) {
    nodeMap.set(n.id, { ...n });
    inDegree.set(n.id, 0);
    childrenMap.set(n.id, []);
  }

  for (const edge of edges) {
    if (nodeMap.has(edge.from) && nodeMap.has(edge.to)) {
      childrenMap.get(edge.from)?.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }
  }

  // Find root nodes (inDegree === 0)
  let queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  // Fallback: If circular or no root found, pick first node
  if (queue.length === 0 && nodes.length > 0) {
    queue.push(nodes[0].id);
  }

  // Assign levels (columns in LR, rows in TB)
  const levels = new Map<string, number>();
  for (const root of queue) {
    levels.set(root, 0);
  }

  const visited = new Set<string>();
  while (queue.length > 0) {
    const currId = queue.shift()!;
    visited.add(currId);
    const currLevel = levels.get(currId) || 0;

    const children = childrenMap.get(currId) || [];
    for (const childId of children) {
      const nextLevel = Math.max(levels.get(childId) || 0, currLevel + 1);
      levels.set(childId, nextLevel);
      if (!visited.has(childId)) {
        queue.push(childId);
      }
    }
  }

  // Handle any orphan nodes not reached by roots
  let maxAssignedLevel = 0;
  for (const lvl of levels.values()) {
    if (lvl > maxAssignedLevel) maxAssignedLevel = lvl;
  }

  for (const node of nodes) {
    if (!levels.has(node.id)) {
      levels.set(node.id, 0);
    }
  }

  // Group nodes by level
  const nodesByLevel = new Map<number, CanvasNode[]>();
  for (const [id, lvl] of levels.entries()) {
    const n = nodeMap.get(id);
    if (n) {
      if (!nodesByLevel.has(lvl)) {
        nodesByLevel.set(lvl, []);
      }
      nodesByLevel.get(lvl)!.push(n);
    }
  }

  const sortedLevels = Array.from(nodesByLevel.keys()).sort((a, b) => a - b);

  if (direction === "LR") {
    let currentX = startX;
    for (const lvl of sortedLevels) {
      const levelNodes = nodesByLevel.get(lvl)!;
      let maxWidthInCol = 0;
      let totalColHeight = 0;

      for (const n of levelNodes) {
        if (n.width > maxWidthInCol) maxWidthInCol = n.width;
        totalColHeight += n.height;
      }
      totalColHeight += (levelNodes.length - 1) * nodeSpacingY;

      let currentY = startY;
      for (const n of levelNodes) {
        n.x = currentX;
        n.y = currentY;
        currentY += n.height + nodeSpacingY;
      }

      currentX += maxWidthInCol + nodeSpacingX;
    }
  } else {
    // Top to bottom
    let currentY = startY;
    for (const lvl of sortedLevels) {
      const levelNodes = nodesByLevel.get(lvl)!;
      let maxHeightInRow = 0;

      for (const n of levelNodes) {
        if (n.height > maxHeightInRow) maxHeightInRow = n.height;
      }

      let currentX = startX;
      for (const n of levelNodes) {
        n.x = currentX;
        n.y = currentY;
        currentX += n.width + nodeSpacingX;
      }

      currentY += maxHeightInRow + nodeSpacingY;
    }
  }

  return Array.from(nodeMap.values());
}

// Calculate clean anchor points between two nodes for an arrow
export function getArrowEndpoints(
  source: CanvasNode,
  target: CanvasNode
): { x1: number; y1: number; x2: number; y2: number } {
  const scx = source.x + source.width / 2;
  const scy = source.y + source.height / 2;
  const tcx = target.x + target.width / 2;
  const tcy = target.y + target.height / 2;

  const dx = tcx - scx;
  const dy = tcy - scy;

  let x1 = scx;
  let y1 = scy;
  let x2 = tcx;
  let y2 = tcy;

  // Choose edge intersection
  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal dominant
    if (dx > 0) {
      x1 = source.x + source.width;
      y1 = scy;
      x2 = target.x;
      y2 = tcy;
    } else {
      x1 = source.x;
      y1 = scy;
      x2 = target.x + target.width;
      y2 = tcy;
    }
  } else {
    // Vertical dominant
    if (dy > 0) {
      x1 = scx;
      y1 = source.y + source.height;
      x2 = tcx;
      y2 = target.y;
    } else {
      x1 = scx;
      y1 = source.y;
      x2 = tcx;
      y2 = target.y + target.height;
    }
  }

  return { x1, y1, x2, y2 };
}
