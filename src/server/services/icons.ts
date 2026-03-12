export function getDrawioShape(hardwareModel: string, role: string): string {
  const model = hardwareModel.toUpperCase();

  // Cisco Nexus
  if (model.includes('NEXUS') || model.includes('N9K') || model.includes('N7K')) {
    return 'shape=mxgraph.cisco19.rect;prIcon=server_switch;fillColor=#FAFAFA;strokeColor=#005073;';
  }
  // Cisco Catalyst
  if (model.includes('WS-C') || model.includes('C9200') || model.includes('C9300')) {
    return 'shape=mxgraph.cisco19.rect;prIcon=l2_switch;fillColor=#FAFAFA;strokeColor=#005073;';
  }
  // Cisco ISR / Routers
  if (model.includes('ISR') || model.includes('ASR') || model.includes('C8000')) {
    return 'shape=mxgraph.cisco19.rect;prIcon=router;fillColor=#FAFAFA;strokeColor=#005073;';
  }
  // Firewalls (SRX, ASA, Firepower)
  if (model.includes('SRX') || model.includes('ASA') || model.includes('FPR')) {
    return 'shape=mxgraph.cisco19.rect;prIcon=firewall;fillColor=#FAFAFA;strokeColor=#005073;';
  }

  // Fallbacks based on role
  switch (role) {
    case 'core':
    case 'distribution':
      return 'shape=mxgraph.cisco19.rect;prIcon=l3_switch;fillColor=#FAFAFA;strokeColor=#005073;';
    case 'router':
      return 'shape=mxgraph.cisco19.rect;prIcon=router;fillColor=#FAFAFA;strokeColor=#005073;';
    case 'firewall':
      return 'shape=mxgraph.cisco19.rect;prIcon=firewall;fillColor=#FAFAFA;strokeColor=#005073;';
    case 'access':
    default:
      return 'shape=mxgraph.cisco19.rect;prIcon=l2_switch;fillColor=#FAFAFA;strokeColor=#005073;';
  }
}
