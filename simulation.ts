import { SystemData, SimulationResult, HourlyDispatch } from './types';

// Matrix math helpers for DC Power Flow
const createMatrix = (rows: number, cols: number, val = 0) => Array(rows).fill(null).map(() => Array(cols).fill(val));

// Gaussian elimination to solve Ax = b
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  // Deep copy to avoid modifying originals
  const M = A.map(row => [...row]);
  const x = [...b];

  for (let i = 0; i < n; i++) {
    // Pivot
    let maxEl = Math.abs(M[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > maxEl) {
        maxEl = Math.abs(M[k][i]);
        maxRow = k;
      }
    }

    // Swap
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    [x[i], x[maxRow]] = [x[maxRow], x[i]];

    // Eliminate
    for (let k = i + 1; k < n; k++) {
      const c = -M[k][i] / M[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) M[k][j] = 0;
        else M[k][j] += c * M[i][j];
      }
      x[k] += c * x[i];
    }
  }

  // Back substitution
  const result = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += M[i][j] * result[j];
    }
    result[i] = (x[i] - sum) / M[i][i];
  }
  return result;
}

export function runSimulation(data: SystemData): SimulationResult {
  const results: SimulationResult = [];

  // B-Matrix construction (Susceptance)
  const numBuses = data.buses.length;
  const B = createMatrix(numBuses, numBuses, 0);

  data.lines.forEach(line => {
    const fromIdx = line.fromBus - 1;
    const toIdx = line.toBus - 1;
    const susceptance = 1 / line.reactance;
    
    B[fromIdx][fromIdx] += susceptance;
    B[toIdx][toIdx] += susceptance;
    B[fromIdx][toIdx] -= susceptance;
    B[toIdx][fromIdx] -= susceptance;
  });

  // Reduced B matrix for DC Flow (Remove Slack Bus, usually Bus 1)
  const slackBusIdx = 0; // Bus 1 is slack
  const B_reduced: number[][] = [];
  for (let i = 0; i < numBuses; i++) {
    if (i === slackBusIdx) continue;
    const row: number[] = [];
    for (let j = 0; j < numBuses; j++) {
      if (j === slackBusIdx) continue;
      row.push(B[i][j]);
    }
    B_reduced.push(row);
  }

  // Iterate through 24 hours
  for (let h = 0; h < 24; h++) {
    const loadFactor = data.loadProfile[h];
    const busLoads = data.buses.map(b => b.baseLoad * loadFactor);
    const totalLoad = busLoads.reduce((a, b) => a + b, 0);

    // --- SCUC (Security Constrained Unit Commitment) ---
    // Simplified: Priority List based on Avg Cost at Max Output
    // In real SCUC, we solve MIP. Here we simulate "Merit Order Commitment".
    const sortedGens = [...data.generators].sort((a, b) => {
      const costA = (a.costB * a.pMax + a.costC) / a.pMax;
      const costB = (b.costB * b.pMax + b.costC) / b.pMax;
      return costA - costB;
    });

    const genStatus: Record<string, boolean> = {};
    let committedCap = 0;
    // Simple Reserve Margin Requirement (e.g., 10%)
    const targetCap = totalLoad * 1.10; 

    for (const gen of sortedGens) {
      if (committedCap < targetCap) {
        genStatus[gen.id] = true;
        committedCap += gen.pMax;
      } else {
        genStatus[gen.id] = false;
      }
    }

    // --- SCED (Security Constrained Economic Dispatch) ---
    // Simplified: Iterative Lambda Search + Congestion Relief Heuristic

    // 1. Initial Unconstrained Economic Dispatch (Equal Lambda / Merit Order)
    // We'll use a simple merit order fill for stability in this demo
    const genOutput: Record<string, number> = {};
    let remainingLoad = totalLoad;
    let systemCost = 0;

    const committedGens = data.generators.filter(g => genStatus[g.id]).sort((a, b) => a.costB - b.costB);
    
    // Set all to Pmin first
    committedGens.forEach(g => {
      genOutput[g.id] = g.pMin;
      remainingLoad -= g.pMin;
      systemCost += g.costC + g.costB * g.pMin; // Startup cost omitted for simplicity in hourly loop
    });

    // Fill remaining load with cheapest available
    for (const g of committedGens) {
      if (remainingLoad <= 0) break;
      const available = g.pMax - g.pMin;
      const take = Math.min(available, remainingLoad);
      genOutput[g.id] += take;
      remainingLoad -= take;
      systemCost += take * g.costB;
    }

    // 2. DC Power Flow Calculation
    // P_inj = P_gen - P_load
    const P_inj = Array(numBuses).fill(0);
    
    // Sum Generation per bus
    data.generators.forEach(g => {
      if (genStatus[g.id]) {
        P_inj[g.busId - 1] += genOutput[g.id];
      }
    });
    // Subtract Load per bus
    busLoads.forEach((load, idx) => {
      P_inj[idx] -= load;
    });

    // Solve for Angles (Theta)
    // P = B * Theta  =>  Theta = inv(B) * P
    const P_reduced = P_inj.filter((_, i) => i !== slackBusIdx);
    // Convert to p.u. (Assuming Base MVA = 100)
    const P_reduced_pu = P_reduced.map(p => p / 100); 

    let angles_reduced: number[] = [];
    try {
        angles_reduced = solveLinearSystem(B_reduced, P_reduced_pu);
    } catch (e) {
        angles_reduced = Array(numBuses - 1).fill(0); // Fallback
    }

    // Reconstruct full angles array
    const angles = Array(numBuses).fill(0);
    let rIdx = 0;
    for (let i = 0; i < numBuses; i++) {
      if (i === slackBusIdx) angles[i] = 0; // Slack reference
      else angles[i] = angles_reduced[rIdx++];
    }

    // Calculate Line Flows
    const lineFlows: Record<string, number> = {};
    const lineLoading: Record<string, number> = {};
    const alerts: string[] = [];

    data.lines.forEach(line => {
      const fromIdx = line.fromBus - 1;
      const toIdx = line.toBus - 1;
      const flow = (angles[fromIdx] - angles[toIdx]) / line.reactance * 100; // *100 for Base MVA
      lineFlows[line.id] = flow;
      const loading = Math.abs(flow) / line.capacity * 100;
      lineLoading[line.id] = loading;

      if (loading > 100) {
        alerts.push(`线路 ${line.fromBus}-${line.toBus} 过载: ${loading.toFixed(1)}%`);
        // Note: Real SCED would re-run dispatch here with line constraints (LMP).
        // For this demo, we just report the violation to show "why SCED is needed".
      }
    });

    // Marginal Unit (Simplified LMP)
    // Find the most expensive unit that is not at max
    const marginalGen = committedGens.find(g => genOutput[g.id] > g.pMin && genOutput[g.id] < g.pMax) || committedGens[committedGens.length-1];
    const systemLambda = marginalGen ? marginalGen.costB : 0;
    
    // Assign uniform LMP for this unconstrained pass (in real SCED, LMPs vary by bus due to congestion)
    const lmp: Record<number, number> = {};
    data.buses.forEach(b => lmp[b.id] = systemLambda);

    results.push({
      hour: h,
      totalLoad,
      genStatus,
      genOutput,
      lineFlows,
      lineLoading,
      systemCost,
      lmp,
      alerts
    });
  }

  return results;
}