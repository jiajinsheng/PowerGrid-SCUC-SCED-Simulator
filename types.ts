export interface Generator {
  id: string;
  name: string;
  busId: number;
  pMin: number;
  pMax: number;
  costA: number; // $/MW^2
  costB: number; // $/MW (Linear cost)
  costC: number; // No-load cost ($/hr)
  startUpCost: number;
  type: 'Thermal' | 'Hydro' | 'Renewable' | 'Nuclear';
  color: string;
}

export interface Bus {
  id: number;
  name: string;
  type: 'Slack' | 'PV' | 'PQ';
  baseLoad: number; // MW
  x: number; // Visual coordinates 0-100
  y: number; // Visual coordinates 0-100
}

export interface TransmissionLine {
  id: string;
  fromBus: number;
  toBus: number;
  reactance: number; // p.u.
  capacity: number; // MW
}

export interface SystemData {
  buses: Bus[];
  generators: Generator[];
  lines: TransmissionLine[];
  loadProfile: number[]; // 24 hourly factors (0.0 - 1.5)
}

export interface HourlyDispatch {
  hour: number;
  totalLoad: number;
  genStatus: Record<string, boolean>; // Unit Commitment
  genOutput: Record<string, number>; // Economic Dispatch
  lineFlows: Record<string, number>; // Power Flow
  lineLoading: Record<string, number>; // % Loading
  systemCost: number;
  lmp: Record<number, number>; // Locational Marginal Price (Simplified)
  alerts: string[];
}

export type SimulationResult = HourlyDispatch[];
