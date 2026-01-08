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
  
  // Add padding to the viewbox so labels on the edges aren't cut off
  // 增加 padding 防止边缘的标签（如顶部的发电机信息或底部的负荷文字）被裁剪
  const paddingX = 60;
  const paddingY = 60;
  const viewBoxStr = `${-paddingX} ${-paddingY} ${width + paddingX * 2} ${height + paddingY * 2}`;
  
  const scaleX = (x: number) => (x / 100) * width;
  const scaleY = (y: number) => (y / 100) * height;

  return (
    <div className="relative bg-grid-900 border border-grid-700 rounded-xl overflow-hidden shadow-inner w-full h-full">
        <svg 
            width="100%" 
            height="100%" 
            viewBox={viewBoxStr} 
            className="select-none"
            preserveAspectRatio="xMidYMid meet"
        >
            <defs>
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="20" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
                </marker>
                {/* Glow filter for active generators */}
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            {/* Grid Background Lines (Optional visual aid) */}
            <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5"/>
            </pattern>
            <rect x={-paddingX} y={-paddingY} width={width + paddingX*2} height={height + paddingY*2} fill="url(#smallGrid)" fillOpacity="0.3" />

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
                            strokeLinecap="round"
                        />
                        {/* Flow Text Label - Midpoint */}
                        <g transform={`translate(${(scaleX(b1.x) + scaleX(b2.x)) / 2}, ${(scaleY(b1.y) + scaleY(b2.y)) / 2})`}>
                            <rect 
                                x="-24" y="-12"
                                width="48" height="24" rx="6"
                                fill="#0f172a" stroke={isOverloaded ? "#ef4444" : "#334155"} strokeWidth="1"
                            />
                            <text 
                                x="0" y="0"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill={isOverloaded ? "#ef4444" : "#cbd5e1"}
                                fontSize="11"
                                fontWeight="bold"
                                style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                                {Math.round(loading)}%
                            </text>
                        </g>
                    </g>
                );
            })}

            {/* Buses */}
            {data.buses.map(bus => {
                const gen = data.generators.find(g => g.busId === bus.id);
                const isGenBus = !!gen;
                
                return (
                    <g key={bus.id} className="cursor-pointer hover:opacity-80 transition-opacity">
                        {/* Bus Circle */}
                        <circle 
                            cx={scaleX(bus.x)} cy={scaleY(bus.y)} 
                            r={isGenBus ? 22 : 14} 
                            fill={isGenBus ? "#1e293b" : "#0f172a"}
                            stroke={isGenBus ? "#3b82f6" : "#94a3b8"}
                            strokeWidth={isGenBus ? 4 : 3}
                            filter={isGenBus && result.genStatus[gen.id] ? "url(#glow)" : ""}
                        />
                        <text 
                            x={scaleX(bus.x)} y={scaleY(bus.y)} 
                            textAnchor="middle" dominantBaseline="middle" 
                            fill="white" fontWeight="bold" fontSize="14"
                        >
                            {bus.id}
                        </text>
                        
                        {/* Load Label - Below the bus */}
                        <text 
                            x={scaleX(bus.x)} 
                            y={scaleY(bus.y) + (isGenBus ? 45 : 35)} 
                            textAnchor="middle" 
                            fill="#94a3b8" 
                            fontSize="12"
                            fontWeight="500"
                        >
                            负荷: {(bus.baseLoad * data.loadProfile[result.hour]).toFixed(0)} MW
                        </text>

                        {/* Generator Indicator - Above the bus */}
                        {isGenBus && (
                            <g transform={`translate(${scaleX(bus.x)}, ${scaleY(bus.y) - 50})`}>
                                {/* Connector line */}
                                <line x1="0" y1="20" x2="0" y2="0" stroke="#475569" strokeWidth="2" />
                                
                                {/* Info Box */}
                                <rect 
                                    x="-40" y="-36" width="80" height="40" rx="6" 
                                    fill="#1e293b" 
                                    stroke={result.genStatus[gen.id] ? "#22c55e" : "#64748b"} 
                                    strokeWidth="2"
                                    className="drop-shadow-md"
                                />
                                <text x="0" y="-22" textAnchor="middle" fill={result.genStatus[gen.id] ? "#4ade80" : "#94a3b8"} fontSize="12" fontWeight="bold">
                                    {result.genStatus[gen.id] ? `${result.genOutput[gen.id]?.toFixed(0)} MW` : "OFF"}
                                </text>
                                <text x="0" y="-7" textAnchor="middle" fill="#cbd5e1" fontSize="10">
                                    ${gen.costB}/MWh
                                </text>
                            </g>
                        )}
                    </g>
                );
            })}
        </svg>
        
        {/* Legend Overlay - Positioned absolutely in the corner */}
        <div className="absolute bottom-4 left-4 bg-grid-900/95 backdrop-blur-sm p-3 rounded-lg border border-grid-700 text-xs text-grid-300 shadow-xl pointer-events-none">
            <div className="flex items-center gap-2 mb-2"><div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-blue-900"></div> <span className="text-slate-200">发电节点</span></div>
            <div className="flex items-center gap-2 mb-2"><div className="w-3 h-3 bg-slate-900 border-2 border-slate-400 rounded-full"></div> <span className="text-slate-200">负荷节点</span></div>
            <div className="flex items-center gap-2"><div className="w-6 h-1 bg-red-500 rounded"></div> <span className="text-slate-200">线路过载 (&gt;100%)</span></div>
        </div>
    </div>
  );
};