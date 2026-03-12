import { create } from 'xmlbuilder2';
import { TopologyData } from '../../shared/types';
import { getDrawioShape } from './icons';

export function generateDrawioXml(topology: TopologyData): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('mxfile', { version: '14.6.13' });

  const layers = ['L1', 'L2', 'L3'];
  const layerNames = { L1: 'Layer 1 (Physical)', L2: 'Layer 2 (Data Link)', L3: 'Layer 3 (Routing)' };

  layers.forEach((layer) => {
    const diagram = root.ele('diagram', { name: layerNames[layer as keyof typeof layerNames], id: `page_${layer}` });
    const mxGraphModel = diagram.ele('mxGraphModel', {
      dx: '1000', dy: '1000', grid: '1', gridSize: '10', guides: '1', tooltips: '1', connect: '1', arrows: '1', fold: '1', page: '1', pageScale: '1', pageWidth: '1169', pageHeight: '827', math: '0', shadow: '0'
    });
    const rootCell = mxGraphModel.ele('root');
    rootCell.ele('mxCell', { id: `root_${layer}_0` });
    rootCell.ele('mxCell', { id: `root_${layer}_1`, parent: `root_${layer}_0` });

    // Add nodes
    topology.nodes.forEach(node => {
      const shape = getDrawioShape(node.hardware_model, node.role);
      const vertex = rootCell.ele('mxCell', {
        id: `${layer}_node_${node.id}`,
        value: `${node.hostname}&#xa;(${node.ip})&#xa;${node.hardware_model}`,
        style: `${shape}whiteSpace=wrap;html=1;verticalAlign=bottom;spacingBottom=-20;`,
        vertex: '1',
        parent: `root_${layer}_1`
      });
      vertex.ele('mxGeometry', {
        x: (node.x || 0).toString(),
        y: (node.y || 0).toString(),
        width: '60',
        height: '60',
        as: 'geometry'
      });
    });

    // Add links for this layer
    const layerLinks = topology.links.filter(l => l.layer === layer);
    layerLinks.forEach(link => {
      const edge = rootCell.ele('mxCell', {
        id: `${layer}_link_${link.id}`,
        value: `${link.src_port} -> ${link.dst_port}&#xa;(${link.protocol})`,
        style: 'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;labelBackgroundColor=none;fontColor=#000000;',
        edge: '1',
        parent: `root_${layer}_1`,
        source: `${layer}_node_${link.source}`,
        target: `${layer}_node_${link.target}`
      });
      edge.ele('mxGeometry', { relative: '1', as: 'geometry' });
    });
  });

  return root.end({ prettyPrint: true });
}
