import { TopologyData, TopologyNode, TopologyLink } from '../../shared/types';

// In a real scenario, this would use TextFSM or complex regex per vendor.
// Here we simulate parsing raw text into our Intermediate Model.
export function parseRawData(rawData: string, vendor: string): TopologyData {
  // Attempt to extract hostname from raw data (basic regex for prompt/hostname)
  let extractedHostname = 'Core-R1';
  let extractedHardware = 'ISR4321';
  
  // Very basic regex to look for typical prompt like "Router#" or "Switch>"
  const promptMatch = rawData.match(/^([a-zA-Z0-9_-]+)[#>]/m);
  if (promptMatch && promptMatch[1]) {
    extractedHostname = promptMatch[1];
  }

  // Basic regex to look for Cisco hardware model in "show version"
  const hwMatch = rawData.match(/(?:cisco|hardware|model)\s+(WS-C\w+|C\d+|Nexus\s+\d+|ISR\d+|ASR\d+)/i);
  if (hwMatch && hwMatch[1]) {
    extractedHardware = hwMatch[1];
  }

  const parsedNodesMap: Record<string, TopologyNode> = {};
  const parsedLinks: TopologyLink[] = [];
  let linkIdCounter = 1;

  // Add the root node
  parsedNodesMap['R1'] = { id: 'R1', hostname: extractedHostname, ip: '10.0.0.1', vendor: vendor as any, hardware_model: extractedHardware, role: 'core' };

  // Attempt to parse LLDP/CDP neighbors (very basic regex for Cisco-like output)
  // Example: Device ID        Local Intf     Hold-time  Capability      Port ID
  //          Switch1          Gi0/0/1        120        B,R             Gi1/0/1
  const neighborRegex = /^([a-zA-Z0-9_.-]+)\s+([A-Za-z0-9/.-]+)\s+\d+\s+(?:[A-Z, ]+)?\s+([A-Za-z0-9/.-]+)$/gm;
  let match;

  while ((match = neighborRegex.exec(rawData)) !== null) {
    const remoteDevice = match[1];
    const localPort = match[2];
    const remotePort = match[3];

    // Skip header lines or self
    if (remoteDevice.toLowerCase() === 'device' || remoteDevice === extractedHostname) continue;

    const remoteId = `N${Object.keys(parsedNodesMap).length + 1}`;
    
    // Create node if not exists (by hostname)
    let existingNodeId = Object.keys(parsedNodesMap).find(k => parsedNodesMap[k].hostname === remoteDevice);
    
    if (!existingNodeId) {
      parsedNodesMap[remoteId] = {
        id: remoteId,
        hostname: remoteDevice,
        ip: '',
        vendor: 'unknown' as any,
        hardware_model: 'Unknown',
        role: remoteDevice.toLowerCase().includes('sw') ? 'access' : 'core'
      };
      existingNodeId = remoteId;
    }

    parsedLinks.push({
      id: `l1_${linkIdCounter++}`,
      source: 'R1',
      target: existingNodeId,
      src_port: localPort,
      dst_port: remotePort,
      layer: 'L1',
      protocol: 'lldp'
    });
  }

  let nodes = Object.values(parsedNodesMap);
  let links = parsedLinks;

  // Fallback to mock data if no neighbors were parsed
  if (links.length === 0) {
    nodes = [
      { id: 'R1', hostname: extractedHostname, ip: '10.0.0.1', vendor: vendor as any, hardware_model: extractedHardware, role: 'core' },
      { id: 'SW1', hostname: 'Dist-SW1', ip: '10.0.0.2', vendor: vendor as any, hardware_model: 'Nexus 9000', role: 'distribution' },
      { id: 'SW2', hostname: 'Acc-SW2', ip: '10.0.0.3', vendor: vendor as any, hardware_model: 'WS-C2960X', role: 'access' },
      { id: 'FW1', hostname: 'Edge-FW1', ip: '10.0.0.254', vendor: vendor as any, hardware_model: 'SRX300', role: 'firewall' },
    ];

    links = [
      // L1 Links
      { id: 'l1_1', source: 'R1', target: 'SW1', src_port: 'Gi0/0/1', dst_port: 'Eth1/1', layer: 'L1', protocol: 'lldp' },
      { id: 'l1_2', source: 'SW1', target: 'SW2', src_port: 'Eth1/2', dst_port: 'Gi1/0/1', layer: 'L1', protocol: 'lldp' },
      { id: 'l1_3', source: 'R1', target: 'FW1', src_port: 'Gi0/0/2', dst_port: 'ge-0/0/0', layer: 'L1', protocol: 'lldp' },
      // L2 Links
      { id: 'l2_1', source: 'SW1', target: 'SW2', src_port: 'Po1', dst_port: 'Po1', layer: 'L2', protocol: 'stp' },
      // L3 Links
      { id: 'l3_1', source: 'R1', target: 'SW1', src_port: 'Vlan10', dst_port: 'Vlan10', layer: 'L3', protocol: 'ospf' },
      { id: 'l3_2', source: 'R1', target: 'FW1', src_port: '10.0.0.1', dst_port: '10.0.0.254', layer: 'L3', protocol: 'bgp' },
    ];
  }

  return { nodes, links };
}

