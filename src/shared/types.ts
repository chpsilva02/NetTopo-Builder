export type Vendor = 'cisco_ios' | 'cisco_nxos' | 'aruba_os' | 'hpe_comware' | 'juniper_junos' | 'huawei_vrp';

export interface CommandProfile {
  l1: string[];
  l2: string[];
  l3: string[];
  hardware: string[];
}

export interface TopologyNode {
  id: string;
  hostname: string;
  ip: string;
  vendor: Vendor | 'unknown';
  hardware_model: string;
  role: 'core' | 'distribution' | 'access' | 'router' | 'firewall' | 'unknown';
  x?: number;
  y?: number;
}

export interface TopologyLink {
  id: string;
  source: string;
  target: string;
  src_port: string;
  dst_port: string;
  layer: 'L1' | 'L2' | 'L3';
  protocol: 'lldp' | 'cdp' | 'stp' | 'ospf' | 'bgp' | 'static' | 'connected';
}

export interface TopologyData {
  nodes: TopologyNode[];
  links: TopologyLink[];
}
