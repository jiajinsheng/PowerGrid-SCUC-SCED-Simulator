import React from 'react';
import { SystemData, HourlyDispatch } from './types';

interface GridMapProps {
  data: SystemData;
  result: HourlyDispatch;
}

export const GridMap: React.FC<GridMapProps> = ({ data, result }) => {
  // Scaling factors for the map 0-100 coordinate system to SVG pixels
  const width = 600;
  const height = 400;
  
  const scaleX = (x: number) => (x / 100) * width;
  const scaleY = (y: number) => (y / 100) * height;

  return (
    <div className="relative bg-grid-900 border border-grid-700 rounded-xl overflow-hidden shadow-inner">
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="select-none">
            <defs>
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="20" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
                </marker>
            </defs>

            {/* Transmission Lines */}
            {data.lines.map(line => {
                const b1 = data.buses.find(b => b.id === line.fromBus)!;
                const b2 = data.buses.find(b => b.id === line.toBus)!;
                const loading = result.lineLoading[line.id];
                const isOverloaded = loading > 100;
                
                // Color interpolation based on loading
                let strokeColor = "#475569"; // Slate 600
                let strokeWidth = 2;
                
                if (loading > 90) { strokeColor = "#ef4444"; strokeWidth = 4; } // Red
                else if (loading > 70) { strokeColor = "#eab308"; strokeWidth = 3; } // Yellow
                else if (loading > 40) { strokeColor = "#3b82f6"; } // Blue

                return (
                    <g key={line.id}>
                        <line 
                            x1={scaleX(b1.x)} y1={scaleY(b1.y)}
                            x2={scaleX(b2.x)} y2={scaleY(b2.y)}
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                            strokeOpacity={0.8}
                        />
                        {/* Flow Text Label - Midpoint */}
                        <rect 
                            x={(scaleX(b1.x) + scaleX(b2.x)) / 2 - 20}
                            y={(scaleY(b1.y) + scaleY(b2.y)) / 2 - 10}
                            width="40" height="20" rx="4"
                            fill="#0f172a" fillOpacity="0.8"
                        />
                        <text 
                            x={(scaleX(b1.x) + scaleX(b2.x)) / 2}
                            y={(scaleY(b1.y) + scaleY(b2.y)) / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={isOverloaded ? "#ef4444" : "#94a3b8"}
                            fontSize="10"
                            fontWeight="bold"
                        >
                            {Math.round(loading)}%
                        </text>
                    </g>
                );
            })}

            {/* Buses */}
            {data.buses.map(bus => {
                const gen = data.generators.find(g => g.busId === bus.id);
                const isGenBus = !!gen;
                
                return (
                    <g key={bus.id} className="cursor-pointer hover:opacity-80 transition-opacity">
                        <circle 
                            cx={scaleX(bus.x)} cy={scaleY(bus.y)} 
                            r={isGenBus ? 20 : 12} 
                            fill={isGenBus ? "#1e293b" : "#0f172a"}
                            stroke={isGenBus ? "#3b82f6" : "#94a3b8"}
                            strokeWidth="3"
                        />
                        <text 
                            x={scaleX(bus.x)} y={scaleY(bus.y)} 
                            textAnchor="middle" dominantBaseline="middle" 
                            fill="white" fontWeight="bold" fontSize="12"
                        >
                            {bus.id}
                        </text>
                        
                        {/* Load Label */}
                        <text x={scaleX(bus.x)} y={scaleY(bus.y) + 35} textAnchor="middle" fill="#94a3b8" fontSize="10">
                            负荷: {(bus.baseLoad * data.loadProfile[result.hour]).toFixed(0)} MW
                        </text>

                        {/* Generator Indicator */}
                        {isGenBus && (
                            <g transform={`translate(${scaleX(bus.x)}, ${scaleY(bus.y) - 40})`}>
                                <rect x="-30" y="-25" width="60" height="34" rx="4" fill="#1e293b" stroke={result.genStatus[gen.id] ? "#22c55e" : "#64748b"} />
                                <text x="0" y="-14" textAnchor="middle" fill={result.genStatus[gen.id] ? "#22c55e" : "#94a3b8"} fontSize="10" fontWeight="bold">
                                    {result.genStatus[gen.id] ? `${result.genOutput[gen.id]?.toFixed(0)} MW` : "停机"}
                                </text>
                                <text x="0" y="-2" textAnchor="middle" fill="#cbd5e1" fontSize="9">
                                    ${gen.costB}/MWh
                                </text>
                            </g>
                        )}
                    </g>
                );
            })}
        </svg>
        
        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 bg-grid-900/90 p-2 rounded border border-grid-700 text-[10px] text-grid-300 pointer-events-none">
            <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> 发电节点</div>
            <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 border-2 border-slate-400 rounded-full"></div> 负荷节点</div>
            <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-red-500"></div> 线路过载 (>100%)</div>
        </div>
    </div>
  );
};