import dagre from 'dagre';
import { TopologyData } from '../../shared/types';

export function applyLayout(topology: TopologyData): TopologyData {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 150 });
  g.setDefaultEdgeLabel(() => ({}));

  topology.nodes.forEach(node => {
    g.setNode(node.id, { width: 60, height: 60 });
  });

  topology.links.forEach(link => {
    g.setEdge(link.source, link.target);
  });

  dagre.layout(g);

  const positionedNodes = topology.nodes.map(node => {
    const pos = g.node(node.id);
    return {
      ...node,
      x: pos.x,
      y: pos.y
    };
  });

  return {
    nodes: positionedNodes,
    links: topology.links
  };
}
