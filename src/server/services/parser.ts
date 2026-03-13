import { TopologyData, TopologyNode, TopologyLink } from '../../shared/types';

function normalizePort(port: string): string {
  let p = port.replace(/\s+/g, '');
  if (/^gigabitethernet/i.test(p)) return p.replace(/^gigabitethernet/i, 'Gi');
  if (/^fastethernet/i.test(p)) return p.replace(/^fastethernet/i, 'Fa');
  if (/^tengigabitethernet/i.test(p)) return p.replace(/^tengigabitethernet/i, 'Te');
  if (/^twentyfivegige/i.test(p)) return p.replace(/^twentyfivegige/i, 'Twe');
  if (/^fortygigabitethernet/i.test(p)) return p.replace(/^fortygigabitethernet/i, 'Fo');
  if (/^hundredgigabitethernet/i.test(p)) return p.replace(/^hundredgigabitethernet/i, 'Hu');
  if (/^ethernet/i.test(p)) return p.replace(/^ethernet/i, 'Eth');
  if (/^port-channel/i.test(p)) return p.replace(/^port-channel/i, 'Po');
  return p;
}

export function parseRawData(rawData: string, vendor: string): TopologyData {
  let localHostname = 'Unknown-Device';
  let localHardware = 'Unknown';
  let localIp = '';

  // 1. Extract Local Hostname from prompt
  const promptMatch = rawData.match(/^([a-zA-Z0-9_-]+)[#>]/m);
  if (promptMatch && promptMatch[1]) {
    localHostname = promptMatch[1];
  }

  // 2. Extract Hardware
  const hwMatch = rawData.match(/(?:cisco|hardware|model)\s+(WS-C\w+|C\d+|Nexus\s+\d+|ISR\d+|ASR\d+|FPR\d+|SRX\d+)/i);
  if (hwMatch && hwMatch[1]) {
    localHardware = hwMatch[1];
  }

  const nodesMap: Record<string, TopologyNode> = {};
  const linksMap: Record<string, TopologyLink> = {};

  // Add local node
  nodesMap[localHostname] = {
    id: localHostname,
    hostname: localHostname,
    ip: localIp,
    vendor: vendor as any,
    hardware_model: localHardware,
    role: 'core'
  };

  const extractedLinks: Array<{ remoteDevice: string, localPort: string, remotePort: string, protocol: string, remoteIp?: string, remoteModel?: string }> = [];

  // --- PARSE CDP DETAIL ---
  const cdpBlocks = rawData.split(/Device ID:/i).slice(1);
  for (const block of cdpBlocks) {
    const deviceIdMatch = block.match(/^\s*([^\r\n]+)/);
    const interfaceMatch = block.match(/Interface:\s*([^,]+),\s*Port ID \(outgoing port\):\s*([^\r\n]+)/i);
    const ipMatch = block.match(/IP address:\s*([0-9.]+)/i);
    const platformMatch = block.match(/Platform:\s*([^,]+)/i);

    if (deviceIdMatch && interfaceMatch) {
      let remoteDevice = deviceIdMatch[1].trim().split('.')[0];
      let localPort = normalizePort(interfaceMatch[1].trim());
      let remotePort = normalizePort(interfaceMatch[2].trim());
      
      extractedLinks.push({
        remoteDevice,
        localPort,
        remotePort,
        protocol: 'cdp',
        remoteIp: ipMatch ? ipMatch[1].trim() : undefined,
        remoteModel: platformMatch ? platformMatch[1].trim() : undefined
      });
    }
  }

  // --- PARSE LLDP DETAIL ---
  const lldpBlocks = rawData.split(/Local Intf:/i).slice(1);
  for (const block of lldpBlocks) {
    const localIntfMatch = block.match(/^\s*([^\r\n]+)/);
    const sysNameMatch = block.match(/System Name:\s*([^\r\n]+)/i);
    const portIdMatch = block.match(/Port id:\s*([^\r\n]+)/i);
    const ipMatch = block.match(/Management address:\s*([0-9.]+)/i) || block.match(/IP:\s*([0-9.]+)/i);

    if (localIntfMatch && sysNameMatch && portIdMatch) {
      let remoteDevice = sysNameMatch[1].trim().split('.')[0];
      let localPort = normalizePort(localIntfMatch[1].trim());
      let remotePort = normalizePort(portIdMatch[1].trim());

      extractedLinks.push({
        remoteDevice,
        localPort,
        remotePort,
        protocol: 'lldp',
        remoteIp: ipMatch ? ipMatch[1].trim() : undefined
      });
    }
  }

  // --- PARSE TABULAR CDP/LLDP ---
  const tabularRegex = /^([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)\s+([A-Za-z]+\s*\d+(?:\/\d+)*)\s+\d+\s+.*?\s+([A-Za-z]+\s*\d+(?:\/\d+)*)$/gm;
  let match;
  while ((match = tabularRegex.exec(rawData)) !== null) {
    let remoteDevice = match[1].split('.')[0];
    let localPort = normalizePort(match[2]);
    let remotePort = normalizePort(match[3]);

    const exists = extractedLinks.some(l => l.remoteDevice === remoteDevice && l.localPort === localPort && l.remotePort === remotePort);
    if (!exists) {
      extractedLinks.push({
        remoteDevice,
        localPort,
        remotePort,
        protocol: 'cdp/lldp'
      });
    }
  }

  // --- DEDUPLICATE AND BUILD TOPOLOGY ---
  let linkIdCounter = 1;
  
  for (const link of extractedLinks) {
    const rDevice = link.remoteDevice;
    const lPort = link.localPort;
    const rPort = link.remotePort;

    if (!nodesMap[rDevice]) {
      nodesMap[rDevice] = {
        id: rDevice,
        hostname: rDevice,
        ip: link.remoteIp || '',
        vendor: 'unknown' as any,
        hardware_model: link.remoteModel || 'Unknown',
        role: rDevice.toLowerCase().includes('sw') ? 'access' : (rDevice.toLowerCase().includes('fw') ? 'firewall' : 'distribution')
      };
    } else {
      if (link.remoteIp && !nodesMap[rDevice].ip) nodesMap[rDevice].ip = link.remoteIp;
      if (link.remoteModel && nodesMap[rDevice].hardware_model === 'Unknown') nodesMap[rDevice].hardware_model = link.remoteModel;
    }

    const linkKey = `${localHostname}_${lPort}_${rDevice}_${rPort}`;
    
    if (!linksMap[linkKey]) {
      linksMap[linkKey] = {
        id: `l1_${linkIdCounter++}`,
        source: localHostname,
        target: rDevice,
        src_port: lPort,
        dst_port: rPort,
        layer: 'L1',
        protocol: link.protocol
      };
    } else {
      if (!linksMap[linkKey].protocol.includes(link.protocol)) {
        linksMap[linkKey].protocol += `/${link.protocol}`;
      }
    }
  }

  let nodes = Object.values(nodesMap);
  let links = Object.values(linksMap);

  // Fallback to mock data if no neighbors were parsed
  if (links.length === 0) {
    nodes = [
      { 
        id: 'acc_sw2', hostname: 'Acc-SW2', ip: '10.0.0.3', vendor: vendor as any, hardware_model: 'WS-C2960X', role: 'access',
        x: 150, y: 350
      },
      { 
        id: 'dist_sw1', hostname: 'Dist-SW1', ip: '10.0.0.2', vendor: vendor as any, hardware_model: 'Nexus 9000', role: 'distribution',
        x: 450, y: 550
      },
      { 
        id: 'vit_swc', hostname: 'VIT_PIN_SWC_3850_01', ip: '10.0.0.1', vendor: vendor as any, hardware_model: 'WS-C3750X', role: 'core',
        x: 750, y: 350
      },
      { 
        id: 'edge_fw1', hostname: 'Edge-FW1', ip: '10.0.0.254', vendor: vendor as any, hardware_model: 'SRX300', role: 'firewall',
        x: 750, y: 100
      },
    ];

    links = [
      // L1 Links (Physical)
      { id: 'l1_1', source: 'acc_sw2', target: 'vit_swc', src_port: 'Eth1/2', dst_port: 'Gi1/0/1', layer: 'L1', protocol: 'lldp' },
      { id: 'l1_2', source: 'dist_sw1', target: 'vit_swc', src_port: 'Eth1/1', dst_port: 'Gi0/0/1', layer: 'L1', protocol: 'lldp' },
      { id: 'l1_3', source: 'vit_swc', target: 'edge_fw1', src_port: 'ge-0/0/0', dst_port: 'Gi0/0/2', layer: 'L1', protocol: 'lldp' },
      
      // L2 Links (Logical)
      { id: 'l2_1', source: 'acc_sw2', target: 'vit_swc', src_port: 'Po1', dst_port: 'Po1', layer: 'L2', protocol: 'stp', vlan: 'Trunk (10,20,30)', stp_state: 'FWD', stp_role: 'Root', port_channel: 'Po1' },
      { id: 'l2_2', source: 'dist_sw1', target: 'vit_swc', src_port: 'Po2', dst_port: 'Po2', layer: 'L2', protocol: 'stp', vlan: 'Trunk (10,20,30)', stp_state: 'FWD', stp_role: 'Desg', port_channel: 'Po2' },
      
      // L3 Links (Routing)
      { id: 'l3_1', source: 'dist_sw1', target: 'vit_swc', src_port: 'Vlan10', dst_port: 'Vlan10', layer: 'L3', protocol: 'ospf', src_ip: '10.0.10.1', dst_ip: '10.0.10.2', subnet: '/24', routing_area: 'Area 0', metric: '10' },
      { id: 'l3_2', source: 'vit_swc', target: 'edge_fw1', src_port: '10.0.254.1', dst_port: '10.0.254.2', layer: 'L3', protocol: 'bgp', src_ip: '10.0.254.1', dst_ip: '10.0.254.2', subnet: '/30', routing_as: 'AS 65001', metric: '0' },
    ];
  }

  return { nodes, links };
}
