import React, { useState, useEffect, useMemo } from 'react';
import { SystemData, SimulationResult } from './types';
import { runSimulation } from './simulation';
import { GridMap } from './GridMap';

// Initial Mock Data (IEEE 5-Bus Simplified System)
const INITIAL_DATA: SystemData = {
  buses: [
    { id: 1, name: "北部电厂", type: "Slack", baseLoad: 0, x: 50, y: 15 },
    { id: 2, name: "东部负荷", type: "PQ", baseLoad: 300, x: 80, y: 40 },
    { id: 3, name: "南部电厂", type: "PV", baseLoad: 100, x: 50, y: 85 },
    { id: 4, name: "西部负荷", type: "PQ", baseLoad: 400, x: 20, y: 40 },
    { id: 5, name: "中心枢纽", type: "PQ", baseLoad: 0, x: 50, y: 50 },
  ],
  generators: [
    { 
      id: "G1", name: "机组 1 (基荷)", busId: 1, pMin: 50, pMax: 600, 
      costA: 0, costB: 20, costC: 100, startUpCost: 500, type: "Nuclear", color: "#60a5fa" 
    },
    { 
      id: "G2", name: "机组 2 (腰荷)", busId: 3, pMin: 20, pMax: 400, 
      costA: 0, costB: 45, costC: 50, startUpCost: 100, type: "Thermal", color: "#f87171" 
    },
    { 
        id: "G3", name: "机组 3 (峰荷)", busId: 2, pMin: 10, pMax: 200, 
        costA: 0, costB: 80, costC: 0, startUpCost: 0, type: "Thermal", color: "#fbbf24" 
    }
  ],
  lines: [
    { id: "L1-2", fromBus: 1, toBus: 2, reactance: 0.02, capacity: 250 },
    { id: "L1-4", fromBus: 1, toBus: 4, reactance: 0.04, capacity: 200 },
    { id: "L1-5", fromBus: 1, toBus: 5, reactance: 0.02, capacity: 400 },
    { id: "L2-3", fromBus: 2, toBus: 3, reactance: 0.02, capacity: 200 },
    { id: "L3-4", fromBus: 3, toBus: 4, reactance: 0.04, capacity: 250 },
    { id: "L4-5", fromBus: 4, toBus: 5, reactance: 0.02, capacity: 300 },
    { id: "L2-5", fromBus: 2, toBus: 5, reactance: 0.02, capacity: 250 },
  ],
  loadProfile: [
    0.6, 0.55, 0.5, 0.5, 0.55, 0.65, 0.8, 0.9, 1.0, 1.1, 1.15, 1.2, 
    1.2, 1.15, 1.1, 1.1, 1.2, 1.3, 1.25, 1.1, 1.0, 0.9, 0.8, 0.7
  ]
};

const App: React.FC = () => {
  const [data, setData] = useState<SystemData>(INITIAL_DATA);
  const [simulationResult, setSimulationResult] = useState<SimulationResult>([]);
  const [currentHour, setCurrentHour] = useState(12);

  // Run simulation whenever data changes
  useEffect(() => {
    const results = runSimulation(data);
    setSimulationResult(results);
  }, [data]);

  const currentResult = simulationResult[currentHour];

  const handleUpdateLoad = (newFactor: number) => {
      const newProfile = [...data.loadProfile];
      newProfile[currentHour] = newFactor;
      setData({...data, loadProfile: newProfile});
  };

  const handleUpdateGenCost = (genId: string, newCost: number) => {
      const newGens = data.generators.map(g => g.id === genId ? {...g, costB: newCost} : g);
      setData({...data, generators: newGens});
  }

  if (!currentResult) return <div className="text-white p-10">正在初始化模拟器...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center shadow-md z-10 sticky top-0">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
                <h1 className="text-xl font-bold tracking-tight text-white">SCUC / SCED 模拟器</h1>
                <p className="text-xs text-slate-400 font-mono">安全约束机组组合与经济调度</p>
            </div>
        </div>
        <div className="flex gap-4 text-sm font-medium">
            <div className="bg-slate-800 px-4 py-2 rounded-md border border-slate-700">
                <span className="text-slate-400 mr-2">系统总成本:</span>
                <span className="text-green-400">${currentResult.systemCost.toFixed(0)}/hr</span>
            </div>
            <div className="bg-slate-800 px-4 py-2 rounded-md border border-slate-700">
                <span className="text-slate-400 mr-2">总负荷:</span>
                <span className="text-blue-400">{currentResult.totalLoad.toFixed(0)} MW</span>
            </div>
        </div>
      </header>

      <main className="p-6 grid grid-cols-12 gap-6 max-w-[1600px] mx-auto">
        
        {/* Left Col: Map & Timeline (8 cols) */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            {/* Visualizer */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-1 shadow-2xl relative group">
                <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur px-3 py-1 rounded text-xs font-mono border border-slate-700">
                   <span className={currentResult.alerts.length > 0 ? "text-red-400 animate-pulse" : "text-green-400"}>
                     状态: {currentResult.alerts.length > 0 ? "存在阻塞 (CONGESTED)" : "正常运行 (NORMAL)"}
                   </span>
                </div>
                <div className="h-[450px]">
                    <GridMap data={data} result={currentResult} />
                </div>
            </div>

            {/* Time Slider */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-lg">
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white">时间轴</h3>
                        <p className="text-slate-400 text-sm">拖动滑块查看不同时段 ({currentHour}:00)</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-white font-mono">{String(currentHour).padStart(2, '0')}:00</div>
                        <div className="text-xs text-blue-400">负荷系数: {data.loadProfile[currentHour].toFixed(2)}x</div>
                    </div>
                </div>
                <input 
                    type="range" min="0" max="23" step="1"
                    value={currentHour}
                    onChange={(e) => setCurrentHour(parseInt(e.target.value))}
                    className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                />
                <div className="flex justify-between mt-2 text-xs text-slate-500 font-mono">
                    <span>00:00</span>
                    <span>06:00</span>
                    <span>12:00</span>
                    <span>18:00</span>
                    <span>23:00</span>
                </div>
            </div>

            {/* Gen Stack Chart (Simple CSS Bar Chart) */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-white mb-4">发电堆叠图 (经济调度排序)</h3>
                <div className="flex items-end h-40 gap-1 bg-slate-950/50 p-4 rounded-lg border border-slate-800/50">
                    {simulationResult.map((res, h) => {
                        const totalHeight = 100; // max height %
                        // Just visualize total load relative to max system capacity roughly
                        const loadPct = (res.totalLoad / 1200) * 100;
                        const isCurrent = h === currentHour;
                        return (
                            <div 
                                key={h} 
                                className={`flex-1 rounded-t-sm transition-all duration-300 relative group cursor-pointer ${isCurrent ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-700 hover:bg-slate-600'}`}
                                style={{ height: `${Math.min(loadPct, 100)}%` }}
                                onClick={() => setCurrentHour(h)}
                            >
                                {isCurrent && <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-bold">当前</div>}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>

        {/* Right Col: Controls (4 cols) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            {/* Control Panel */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                    系统控制
                </h3>
                
                <div className="space-y-6">
                    {/* Load Control */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 flex justify-between">
                            <span>当前小时负荷调整</span>
                            <span className="text-blue-400 font-mono">{data.loadProfile[currentHour].toFixed(2)}x</span>
                        </label>
                        <input 
                            type="range" min="0.5" max="2.0" step="0.05"
                            value={data.loadProfile[currentHour]}
                            onChange={(e) => handleUpdateLoad(parseFloat(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    <div className="h-px bg-slate-700 my-4"></div>

                    {/* Generator Costs */}
                    <div className="space-y-4">
                        <label className="text-sm font-medium text-slate-300">发电机组边际成本 ($/MWh)</label>
                        {data.generators.map(gen => (
                            <div key={gen.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex items-center gap-3">
                                <div className="w-2 h-8 rounded-full" style={{background: gen.color}}></div>
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-bold text-slate-200">{gen.name}</span>
                                        <span className="text-slate-400">${gen.costB}</span>
                                    </div>
                                    <input 
                                        type="range" min="10" max="200" step="5"
                                        value={gen.costB}
                                        onChange={(e) => handleUpdateGenCost(gen.id, parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-slate-400 hover:accent-white"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

      </main>
    </div>
  );
};

export default App;