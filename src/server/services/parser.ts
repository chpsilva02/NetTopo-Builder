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
      { 
        id: 'R1', hostname: extractedHostname, ip: '10.0.0.1', vendor: vendor as any, hardware_model: extractedHardware, role: 'core',
        os_version: 'IOS XE 16.9.5', serial_number: 'FOC2345ABCD', uptime: '45 days, 12:30', mac_address: '00:1A:2B:3C:4D:5E'
      },
      { 
        id: 'SW1', hostname: 'Dist-SW1', ip: '10.0.0.2', vendor: vendor as any, hardware_model: 'Nexus 93180YC-EX', role: 'distribution',
        os_version: 'NX-OS 9.3(8)', serial_number: 'JAF1234XYZ', uptime: '120 days, 08:15', mac_address: '00:1A:2B:3C:4D:5F'
      },
      { 
        id: 'SW2', hostname: 'Acc-SW2', ip: '10.0.0.3', vendor: vendor as any, hardware_model: 'WS-C9200L-48P-4G', role: 'access',
        os_version: 'IOS XE 17.3.4', serial_number: 'FOC9876QWER', uptime: '12 days, 01:10', mac_address: '00:1A:2B:3C:4D:60'
      },
      { 
        id: 'FW1', hostname: 'Edge-FW1', ip: '10.0.0.254', vendor: vendor as any, hardware_model: 'FPR2110', role: 'firewall',
        os_version: 'FTD 7.0.1', serial_number: 'JMX5678ASDF', uptime: '200 days, 22:45', mac_address: '00:1A:2B:3C:4D:61'
      },
    ];

    links = [
      // L1 Links (Physical)
      { id: 'l1_1', source: 'R1', target: 'SW1', src_port: 'Gi0/0/1', dst_port: 'Eth1/1', layer: 'L1', protocol: 'lldp', speed: '10G', state: 'up/up', transceiver: 'SFP-10G-LR' },
      { id: 'l1_2', source: 'SW1', target: 'SW2', src_port: 'Eth1/2', dst_port: 'Gi1/0/1', layer: 'L1', protocol: 'lldp', speed: '1G', state: 'up/up', transceiver: 'GLC-TE' },
      { id: 'l1_3', source: 'SW1', target: 'SW2', src_port: 'Eth1/3', dst_port: 'Gi1/0/2', layer: 'L1', protocol: 'lldp', speed: '1G', state: 'up/up', transceiver: 'GLC-TE' },
      { id: 'l1_4', source: 'R1', target: 'FW1', src_port: 'Gi0/0/2', dst_port: 'Eth1/1', layer: 'L1', protocol: 'cdp', speed: '10G', state: 'up/up', transceiver: 'SFP-10G-SR' },
      
      // L2 Links (Logical)
      { id: 'l2_1', source: 'SW1', target: 'SW2', src_port: 'Po1', dst_port: 'Po1', layer: 'L2', protocol: 'stp', vlan: 'Trunk (10,20,30)', stp_state: 'FWD', stp_role: 'Root', port_channel: 'Po1' },
      { id: 'l2_2', source: 'SW2', target: 'SW1', src_port: 'Po1', dst_port: 'Po1', layer: 'L2', protocol: 'stp', vlan: 'Trunk (10,20,30)', stp_state: 'FWD', stp_role: 'Desg', port_channel: 'Po1' },
      
      // L3 Links (Routing)
      { id: 'l3_1', source: 'R1', target: 'SW1', src_port: 'Vlan10', dst_port: 'Vlan10', layer: 'L3', protocol: 'ospf', src_ip: '10.0.10.1', dst_ip: '10.0.10.2', subnet: '/24', routing_area: 'Area 0', metric: '10' },
      { id: 'l3_2', source: 'R1', target: 'FW1', src_port: '10.0.254.1', dst_port: '10.0.254.2', layer: 'L3', protocol: 'bgp', src_ip: '10.0.254.1', dst_ip: '10.0.254.2', subnet: '/30', routing_as: 'AS 65001', metric: '0' },
    ];
  }

  return { nodes, links };
}

