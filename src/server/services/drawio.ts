import { create } from 'xmlbuilder2';
import { TopologyData, TopologyNode, TopologyLink } from '../../shared/types';
import { getDrawioShape } from './icons';

function buildNodeLabel(node: TopologyNode): string {
  let label = `<b>${node.hostname}</b><br/>${node.ip}<br/>${node.hardware_model}`;
  if (node.os_version) label += `<br/><span style="color: #666666; font-size: 10px;">OS: ${node.os_version}</span>`;
  if (node.serial_number) label += `<br/><span style="color: #666666; font-size: 10px;">SN: ${node.serial_number}</span>`;
  if (node.uptime) label += `<br/><span style="color: #666666; font-size: 10px;">Up: ${node.uptime}</span>`;
  return label;
}

function buildLinkLabel(link: TopologyLink, layer: string): string {
  let label = `<b>${link.src_port}</b> ➔ <b>${link.dst_port}</b>`;
  
  if (layer === 'L1') {
    if (link.speed) label += `<br/><span style="color: #666666; font-size: 10px;">Speed: ${link.speed}</span>`;
    if (link.state) label += `<br/><span style="color: #666666; font-size: 10px;">State: ${link.state}</span>`;
    if (link.transceiver) label += `<br/><span style="color: #666666; font-size: 10px;">Tx: ${link.transceiver}</span>`;
  } else if (layer === 'L2') {
    if (link.vlan) label += `<br/><span style="color: #666666; font-size: 10px;">VLAN: ${link.vlan}</span>`;
    if (link.stp_state) label += `<br/><span style="color: #666666; font-size: 10px;">STP: ${link.stp_state} ${link.stp_role ? `(${link.stp_role})` : ''}</span>`;
    if (link.port_channel) label += `<br/><span style="color: #666666; font-size: 10px;">Po: ${link.port_channel}</span>`;
  } else if (layer === 'L3') {
    label += `<br/><span style="color: #666666; font-size: 10px;">Proto: ${link.protocol.toUpperCase()}</span>`;
    if (link.src_ip && link.dst_ip) label += `<br/><span style="color: #666666; font-size: 10px;">${link.src_ip} ➔ ${link.dst_ip}</span>`;
    if (link.subnet) label += `<br/><span style="color: #666666; font-size: 10px;">Subnet: ${link.subnet}</span>`;
    if (link.routing_area) label += `<br/><span style="color: #666666; font-size: 10px;">Area: ${link.routing_area}</span>`;
    if (link.routing_as) label += `<br/><span style="color: #666666; font-size: 10px;">AS: ${link.routing_as}</span>`;
    if (link.metric) label += `<br/><span style="color: #666666; font-size: 10px;">Metric: ${link.metric}</span>`;
  }
  
  return label;
}

export function generateDrawioXml(topology: TopologyData): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('mxfile', { version: '14.6.13' });

  const layers = ['L1', 'L2', 'L3'];
  const layerNames = { 
    L1: 'Topologia Layer 1 (Física - baseada em LLDP/CDP)', 
    L2: 'Topologia Layer 2 (Lógica - baseada em STP e VLANs)', 
    L3: 'Topologia Layer 3 (Roteamento - baseada em Tabela de Rotas, OSPF, BGP)' 
  };

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
        value: buildNodeLabel(node),
        style: `${shape}whiteSpace=wrap;html=1;verticalLabelPosition=bottom;verticalAlign=top;spacingTop=4;`,
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
        value: buildLinkLabel(link, layer),
        style: 'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;labelBackgroundColor=#ffffff;fontColor=#000000;align=center;verticalAlign=middle;',
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
