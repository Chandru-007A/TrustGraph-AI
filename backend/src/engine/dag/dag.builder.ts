import { WorkflowNode, NodeStatus } from '@prisma/client';
import logger from '../../utils/logger';
import ApiError from '../../utils/ApiError';
import httpStatus from 'http-status';

export interface DAGNode {
  id: string;
  name: string;
  status: NodeStatus;
  agentDid: string;
  startTime: Date | null;
  endTime: Date | null;
  durationMs: number | null;
  parents: string[];
  children: string[];
}

export interface ReactFlowNode {
  id: string;
  position: { x: number; y: number };
  data: {
    label: string;
    status: NodeStatus;
    agentDid: string;
    durationMs: number | null;
  };
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
}

export interface ReactFlowData {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
}

export class DAGBuilder {
  private nodes: Map<string, DAGNode> = new Map();
  private readonly sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Load the DAG from a list of Prisma WorkflowNode records.
   */
  loadFromDatabase(dbNodes: WorkflowNode[]): void {
    this.nodes.clear();
    for (const node of dbNodes) {
      this.nodes.set(node.id, {
        id: node.id,
        name: node.nodeName || `Node-${node.stepIndex}`,
        status: node.status,
        agentDid: node.agentDid,
        startTime: node.startTime,
        endTime: node.endTime,
        durationMs:
          node.startTime && node.endTime
            ? node.endTime.getTime() - node.startTime.getTime()
            : null,
        parents: node.parentNodeIds || [],
        children: node.childNodeIds || [],
      });
    }
    
    // Ensure all references are valid
    this.validateReferences();
  }

  /**
   * Add a single node to the DAG manually.
   */
  addNode(node: DAGNode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`Node ${node.id} already exists in DAG`);
    }
    this.nodes.set(node.id, node);
  }

  /**
   * Add a directed edge from sourceNodeId to targetNodeId.
   */
  addEdge(sourceNodeId: string, targetNodeId: string): void {
    const source = this.nodes.get(sourceNodeId);
    const target = this.nodes.get(targetNodeId);

    if (!source) throw new Error(`Source node ${sourceNodeId} not found`);
    if (!target) throw new Error(`Target node ${targetNodeId} not found`);

    if (!source.children.includes(targetNodeId)) {
      source.children.push(targetNodeId);
    }
    if (!target.parents.includes(sourceNodeId)) {
      target.parents.push(sourceNodeId);
    }
  }

  /**
   * Validate that all parent and child references point to existing nodes.
   */
  private validateReferences(): void {
    for (const [id, node] of this.nodes.entries()) {
      for (const parentId of node.parents) {
        if (!this.nodes.has(parentId)) {
          throw new Error(`Node ${id} references missing parent ${parentId}`);
        }
      }
      for (const childId of node.children) {
        if (!this.nodes.has(childId)) {
          throw new Error(`Node ${id} references missing child ${childId}`);
        }
      }
    }
  }

  /**
   * Detect cycles using Depth-First Search with coloring.
   * Throws if a cycle is detected.
   */
  validateNoCycles(): void {
    const visited = new Map<string, number>();
    // 0 = unvisited, 1 = visiting, 2 = visited completely

    const hasCycle = (nodeId: string): boolean => {
      visited.set(nodeId, 1);
      const node = this.nodes.get(nodeId);
      if (node) {
        for (const childId of node.children) {
          const status = visited.get(childId) || 0;
          if (status === 1) return true; // Cycle detected
          if (status === 0 && hasCycle(childId)) return true;
        }
      }
      visited.set(nodeId, 2);
      return false;
    };

    for (const id of this.nodes.keys()) {
      if (!visited.has(id)) {
        if (hasCycle(id)) {
          throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, 'Cycle detected in Workflow DAG');
        }
      }
    }
  }

  /**
   * Return nodes in topologically sorted order using Kahn's Algorithm.
   */
  topologicalSort(): DAGNode[] {
    this.validateNoCycles();

    const inDegree = new Map<string, number>();
    for (const id of this.nodes.keys()) {
      inDegree.set(id, 0);
    }

    for (const node of this.nodes.values()) {
      for (const childId of node.children) {
        inDegree.set(childId, (inDegree.get(childId) || 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) queue.push(id);
    }

    const result: DAGNode[] = [];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const node = this.nodes.get(currentId)!;
      result.push(node);

      for (const childId of node.children) {
        inDegree.set(childId, inDegree.get(childId)! - 1);
        if (inDegree.get(childId) === 0) {
          queue.push(childId);
        }
      }
    }

    return result;
  }

  /**
   * Traverse the graph using Breadth-First Search.
   */
  bfs(startNodeId?: string): DAGNode[] {
    const result: DAGNode[] = [];
    const queue: string[] = [];
    const visited = new Set<string>();

    if (startNodeId) {
      if (this.nodes.has(startNodeId)) queue.push(startNodeId);
    } else {
      // Find all root nodes
      for (const node of this.nodes.values()) {
        if (node.parents.length === 0) queue.push(node.id);
      }
    }

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (!visited.has(currentId)) {
        visited.add(currentId);
        const node = this.nodes.get(currentId)!;
        result.push(node);
        for (const childId of node.children) {
          if (!visited.has(childId)) {
            queue.push(childId);
          }
        }
      }
    }

    return result;
  }

  /**
   * Traverse the graph using Depth-First Search.
   */
  dfs(startNodeId?: string): DAGNode[] {
    const result: DAGNode[] = [];
    const visited = new Set<string>();

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const node = this.nodes.get(nodeId);
      if (node) {
        result.push(node);
        for (const childId of node.children) {
          traverse(childId);
        }
      }
    };

    if (startNodeId) {
      traverse(startNodeId);
    } else {
      // Find all root nodes
      for (const node of this.nodes.values()) {
        if (node.parents.length === 0) {
          traverse(node.id);
        }
      }
    }

    return result;
  }

  /**
   * Export the DAG standard JSON representation.
   */
  toJSON(): { sessionId: string; nodes: DAGNode[] } {
    return {
      sessionId: this.sessionId,
      nodes: Array.from(this.nodes.values()),
    };
  }

  /**
   * Export the DAG tailored for React Flow visualization.
   * Auto-assigns simplistic coordinates based on BFS depth.
   */
  toReactFlow(): ReactFlowData {
    const nodes: ReactFlowNode[] = [];
    const edges: ReactFlowEdge[] = [];
    
    // Simplistic depth calculation for layout
    const depthMap = new Map<string, number>();
    const roots = Array.from(this.nodes.values()).filter(n => n.parents.length === 0);
    
    const calculateDepth = (nodeId: string, depth: number) => {
      if (!depthMap.has(nodeId) || depth > depthMap.get(nodeId)!) {
        depthMap.set(nodeId, depth);
      }
      const node = this.nodes.get(nodeId);
      if (node) {
        for (const childId of node.children) {
          calculateDepth(childId, depth + 1);
        }
      }
    };

    for (const root of roots) {
      calculateDepth(root.id, 0);
    }

    // Group by depth to space horizontally
    const nodesByDepth = new Map<number, string[]>();
    for (const [id, depth] of depthMap.entries()) {
      if (!nodesByDepth.has(depth)) nodesByDepth.set(depth, []);
      nodesByDepth.get(depth)!.push(id);
    }

    const X_SPACING = 250;
    const Y_SPACING = 150;

    for (const [depth, ids] of nodesByDepth.entries()) {
      ids.forEach((id, index) => {
        const node = this.nodes.get(id)!;
        nodes.push({
          id: node.id,
          position: { x: depth * X_SPACING, y: index * Y_SPACING },
          data: {
            label: node.name,
            status: node.status,
            agentDid: node.agentDid,
            durationMs: node.durationMs,
          },
        });
        
        for (const childId of node.children) {
          edges.push({
            id: `e-${node.id}-${childId}`,
            source: node.id,
            target: childId,
          });
        }
      });
    }

    return { nodes, edges };
  }
}
