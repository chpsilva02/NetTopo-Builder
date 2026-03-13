import { create } from 'xmlbuilder2';
import { TopologyData, TopologyNode, TopologyLink } from '../../shared/types';
import { getDrawioShape } from './icons';

function buildNodeLabel(node: TopologyNode): string {
  let label = `<b>${node.hostname}</b><br/>(${node.ip})<br/>${node.hardware_model}`;
  if (node.os_version) label += `<br/><span style="color: #666666; font-size: 10px;">OS: ${node.os_version}</span>`;
  if (node.serial_number) label += `<br/><span style="color: #666666; font-size: 10px;">SN: ${node.serial_number}</span>`;
  if (node.uptime) label += `<br/><span style="color: #666666; font-size: 10px;">Up: ${node.uptime}</span>`;
  return label;
}

function buildLinkCenterLabel(link: TopologyLink, layer: string): string {
  let label = '';
  if (layer === 'L1') {
    if (link.speed) label += `<span style="color: #666666; font-size: 10px;">Speed: ${link.speed}</span><br/>`;
    if (link.state) label += `<span style="color: #666666; font-size: 10px;">State: ${link.state}</span><br/>`;
    if (link.transceiver) label += `<span style="color: #666666; font-size: 10px;">Tx: ${link.transceiver}</span>`;
  } else if (layer === 'L2') {
    // Removed verbose VLAN/STP text from center label as requested
    if (link.port_channel) label += `<span style="color: #666666; font-size: 10px;">Po: ${link.port_channel}</span>`;
  } else if (layer === 'L3') {
    label += `<span style="color: #666666; font-size: 10px;">Proto: ${link.protocol.toUpperCase()}</span><br/>`;
    if (link.src_ip && link.dst_ip) label += `<span style="color: #666666; font-size: 10px;">${link.src_ip} ➔ ${link.dst_ip}</span><br/>`;
    if (link.subnet) label += `<span style="color: #666666; font-size: 10px;">Subnet: ${link.subnet}</span><br/>`;
    if (link.routing_area) label += `<span style="color: #666666; font-size: 10px;">Area: ${link.routing_area}</span><br/>`;
    if (link.routing_as) label += `<span style="color: #666666; font-size: 10px;">AS: ${link.routing_as}</span><br/>`;
    if (link.metric) label += `<span style="color: #666666; font-size: 10px;">Metric: ${link.metric}</span>`;
  }
  return label;
}

export function generateDrawioXml(topology: TopologyData): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('mxfile', { version: '21.6.8' });

  const layers = ['L1', 'L2', 'L3'];
  const layerNames = { 
    L1: 'Topologia Layer 1 (Física)', 
    L2: 'Topologia Layer 2 (Lógica)', 
    L3: 'Topologia Layer 3 (Roteamento)' 
  };

  layers.forEach((layer) => {
    const diagram = root.ele('diagram', { name: layerNames[layer as keyof typeof layerNames], id: `page_${layer}` });
    const mxGraphModel = diagram.ele('mxGraphModel', {
      dx: '1200', dy: '800', grid: '1', gridSize: '10', guides: '1', tooltips: '1', connect: '1', arrows: '1', fold: '1', page: '1', pageScale: '1', pageWidth: '1169', pageHeight: '827', math: '0', shadow: '0'
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
        style: `${shape}whiteSpace=wrap;html=1;verticalLabelPosition=bottom;verticalAlign=top;spacingTop=8;`,
        vertex: '1',
        parent: `root_${layer}_1`
      });
      vertex.ele('mxGeometry', {
        x: (node.x !== undefined ? node.x : 0).toString(),
        y: (node.y !== undefined ? node.y : 0).toString(),
        width: '60',
        height: '60',
        as: 'geometry'
      });

      if (layer === 'L2' && node.isRoot) {
        const rootLabel = rootCell.ele('mxCell', {
          id: `${layer}_node_${node.id}_root_label`,
          value: 'ROOT BRIDGE',
          style: 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontColor=#FF0000;fontStyle=1;fontSize=12;',
          vertex: '1',
          parent: `root_${layer}_1`
        });
        rootLabel.ele('mxGeometry', {
          x: (node.x !== undefined ? node.x - 20 : -20).toString(),
          y: (node.y !== undefined ? node.y - 25 : -25).toString(),
          width: '100',
          height: '20',
          as: 'geometry'
        });
      }
    });

    // Add links for this layer
    const layerLinks = topology.links.filter(l => l.layer === layer);
    layerLinks.forEach(link => {
      const edgeId = `${layer}_link_${link.id}`;
      const centerLabel = buildLinkCenterLabel(link, layer);
      
      let edgeStyle = 'endArrow=none;html=1;rounded=0;strokeWidth=2;strokeColor=#444444;labelBackgroundColor=#ffffff;fontColor=#333333;fontSize=10;';
      
      const edge = rootCell.ele('mxCell', {
        id: edgeId,
        value: centerLabel,
        style: edgeStyle,
        edge: '1',
        parent: `root_${layer}_1`,
        source: `${layer}_node_${link.source}`,
        target: `${layer}_node_${link.target}`
      });
      edge.ele('mxGeometry', { relative: '1', as: 'geometry' });

      const formatStpPort = (port: string, role?: string, state?: string) => {
        if (layer !== 'L2' || (!role && !state)) return port;
        
        let icon = '';
        if (state === 'FWD') icon = '🟢 ';
        else if (state === 'BLK' || state === 'Altn' || state === 'DIS') icon = '❌ ';
        else if (state) icon = '🟠 ';
        
        let roleStr = '';
        if (role === 'Desg') roleStr = 'DP';
        else if (role === 'Root') roleStr = 'RP';
        else if (role === 'Altn') roleStr = 'ALT';
        else if (role === 'Back') roleStr = 'BKP';
        else if (role) roleStr = role.toUpperCase();
        
        let label = `${icon}${port}`;
        if (roleStr) {
          label += `<br><font color="#FF0000"><b>${roleStr}</b></font>`;
        }
        return label;
      };

      // Source Port Label
      if (link.src_port) {
        const srcLabel = rootCell.ele('mxCell', {
          id: `${edgeId}_src_label`,
          value: formatStpPort(link.src_port, link.src_stp_role, link.src_stp_state),
          style: 'edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];labelBackgroundColor=#ffffff;fontSize=11;fontColor=#333333;',
          vertex: '1',
          connectable: '0',
          parent: edgeId
        });
        srcLabel.ele('mxGeometry', { x: '-0.7', relative: '1', as: 'geometry' }).ele('mxPoint', { as: 'offset' });
      }

      // Target Port Label
      if (link.dst_port) {
        const dstLabel = rootCell.ele('mxCell', {
          id: `${edgeId}_dst_label`,
          value: formatStpPort(link.dst_port, link.dst_stp_role, link.dst_stp_state),
          style: 'edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];labelBackgroundColor=#ffffff;fontSize=11;fontColor=#333333;',
          vertex: '1',
          connectable: '0',
          parent: edgeId
        });
        dstLabel.ele('mxGeometry', { x: '0.7', relative: '1', as: 'geometry' }).ele('mxPoint', { as: 'offset' });
      }
    });
  });

  return root.end({ prettyPrint: true });
}
