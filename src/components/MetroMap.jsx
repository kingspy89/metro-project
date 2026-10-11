import React, { useState, useRef, useEffect } from 'react';
import stopsData from '../data/stops.json' with { type: 'json' };
import linesData from '../data/lines.json' with { type: 'json' };
import transfersData from '../data/transfers.json' with { type: 'json' };
import connectionsData from '../data/connections.json' with { type: 'json' };
import { stopsById } from '../engine/graph.js';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Filter, 
  Layers, 
  Train, 
  Bus, 
  Footprints,
  Compass
} from 'lucide-react';

export default function MetroMap({ selectedJourney, onSelectStation, activeLang = 'bilingual' }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'metro', 'brts', 'amts', 'route_only'
  const [hoveredStation, setHoveredStation] = useState(null);
  const svgRef = useRef(null);

  // Collect stops in active journey
  const journeyStopIds = [];
  if (selectedJourney) {
    for (const leg of selectedJourney.legs) {
      if (!journeyStopIds.includes(leg.fromStop)) journeyStopIds.push(leg.fromStop);
      if (leg.intermediateStops) {
        for (const mid of leg.intermediateStops) {
          if (!journeyStopIds.includes(mid)) journeyStopIds.push(mid);
        }
      }
      if (!journeyStopIds.includes(leg.toStop)) journeyStopIds.push(leg.toStop);
    }
  }

  // Active journey path points
  const activePathPoints = journeyStopIds
    .map(id => stopsById.get(id))
    .filter(Boolean)
    .map(s => `${s.schematic_x},${s.schematic_y}`);
  const activeLegPaths = selectedJourney?.legs.map((leg, index) => {
    const stopIds = [leg.fromStop, ...(leg.intermediateStops || []), leg.toStop];
    const points = stopIds.map(id => stopsById.get(id)).filter(Boolean)
      .map(stop => `${stop.schematic_x},${stop.schematic_y}`);
    const lineColor = leg.type === 'transfer' ? '#C4B5FD'
      : leg.mode !== 'metro' ? (leg.mode === 'brts' ? '#34D399' : '#FBBF24')
        : leg.lineId === 'LINE_METRO_NS' ? '#FB7185'
          : leg.lineId === 'LINE_METRO_GANDHINAGAR' ? '#C4B5FD' : '#60A5FA';
    return { key: `${index}-${leg.fromStop}-${leg.toStop}`, type: leg.type, mode: leg.mode, color: lineColor, d: points.length > 1 ? `M ${points.join(' L ')}` : '' };
  }).filter(leg => leg.d) || [];
  const journeyKey = selectedJourney?.signature || selectedJourney?.legs
    .map(leg => `${leg.type}:${leg.fromStop}>${leg.toStop}`).join('|') || '';

  // Center on active route when selected
  useEffect(() => {
    if (selectedJourney && activePathPoints.length > 0) {
      const stops = journeyStopIds.map(id => stopsById.get(id)).filter(Boolean);
      if (stops.length > 0) {
        const xs = stops.map(s => s.schematic_x);
        const ys = stops.map(s => s.schematic_y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        
        // Gentle pan to center the active route
        setPan({
          x: (800 - midX) * 0.5,
          y: (480 - midY) * 0.5
        });
      }
    }
  }, [journeyKey]);

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
    setZoom(prev => Math.min(2.8, Math.max(0.65, prev * zoomFactor)));
  };

  // Mouse drag handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('.station-node-group') || e.target.closest('.map-control-btn')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const isModeVisible = (mode) => {
    if (filterMode === 'route_only') return false;
    if (filterMode === 'all') return true;
    return filterMode === mode;
  };

  const isStationVisible = (stop) => {
    if (filterMode === 'all' || filterMode === 'route_only') return true;
    return stop.transport_mode === filterMode;
  };

  const modeFilterColor = {
    all: '#F0832D',
    metro: '#3B82F6',
    brts: '#10B981',
    amts: '#F59E0B',
  };

  // Draw each rail segment between adjacent stops from the routing graph.
  // This keeps the displayed sequence in sync with the route planner instead
  // of drawing a single straight corridor through unrelated stations.
  const metroSegments = connectionsData
    .filter(edge => edge.transport_mode === 'metro' && edge.from_stop_id < edge.to_stop_id)
    .map(edge => ({ edge, from: stopsById.get(edge.from_stop_id), to: stopsById.get(edge.to_stop_id) }))
    .filter(({ from, to }) => from && to);

  // Only show transfers when all modes are visible (multi-mode context)
  const showTransfers = filterMode === 'all' || filterMode === 'route_only';

  return (
    <div className="metro-map-wrapper">
      {/* Map Interactive Toolbar */}
      <div className="map-toolbar">
        <button
          className="map-control-btn"
          onClick={() => setZoom(prev => Math.min(2.8, prev * 1.2))}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn size={18} />
        </button>
        <button
          className="map-control-btn"
          onClick={() => setZoom(prev => Math.max(0.65, prev * 0.82))}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut size={18} />
        </button>
        <button
          className="map-control-btn"
          onClick={handleResetView}
          title="Reset View"
          aria-label="Reset map view"
        >
          <RotateCcw size={16} />
        </button>

        <div className="map-toolbar-divider" />

        {/* Network Filter Pills */}
        <div className="map-filter-list">
          {['all', 'metro', 'brts', 'amts'].map(mode => {
            const isActive = filterMode === mode;
            const activeColor = modeFilterColor[mode];
            return (
              <button
                key={mode}
                className={`map-filter-btn${isActive ? ' active' : ''}`}
                data-mode={mode}
                aria-pressed={isActive}
                onClick={() => setFilterMode(mode)}
                style={isActive ? { '--filter-color': activeColor } : undefined}
              >
                {mode === 'all' ? 'All Lines' : mode === 'metro' ? '🚇 Metro' : mode === 'brts' ? '🚌 BRTS' : '🚎 AMTS'}
              </button>
            );
          })}
        </div>
      </div>

      {/* SVG Canvas Container with Smooth Pan/Zoom Matrix */}
      <div
        className="schematic-svg-viewport"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 1640 980"
          style={{
            width: '100%',
            height: '100%',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Schematic Multimodal Metro Map of Ahmedabad"
        >
          <defs>
            {/* Active route glow filter */}
            <filter id="route-highlight-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#38BDF8" floodOpacity="0.9" />
            </filter>

            {/* Sabarmati River Gradient */}
            <linearGradient id="river-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0284C7" stopOpacity="0.22" />
              <stop offset="50%" stopColor="#0EA5E9" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#0284C7" stopOpacity="0.22" />
            </linearGradient>

            {/* Chevron marker for BRTS */}
            <marker id="brts-chevron" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 5 5 L 0 9" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
            </marker>
          </defs>

          {/* 1. Subtle Cartographic Grid Background */}
          <g opacity="0.05" stroke="#FFFFFF" strokeWidth="1">
            <line x1="0" y1="560" x2="1640" y2="560" />
            <line x1="0" y1="720" x2="1640" y2="720" />
            <line x1="0" y1="50" x2="1640" y2="50" />
            <line x1="540" y1="0" x2="540" y2="980" />
          </g>

          {/* 2. Sabarmati River Water Ribbon (Meandering geographic landmark) */}
          <g id="sabarmati-river-corridor">
            <path
              d="M 690 0 C 680 180, 650 360, 620 540 C 600 660, 580 820, 560 980"
              stroke="url(#river-gradient)"
              strokeWidth="54"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 690 0 C 680 180, 650 360, 620 540 C 600 660, 580 820, 560 980"
              stroke="#0284C7"
              strokeWidth="3"
              strokeDasharray="12 8"
              fill="none"
              opacity="0.4"
            />
            {/* River Label */}
            <text x="635" y="220" fill="#38BDF8" fontSize="13" fontWeight="700" letterSpacing="0.1em" opacity="0.6" transform="rotate(78 635 220)">
              SABARMATI RIVER · સાબરમતી નદી
            </text>
          </g>

          {/* 3. Walking Transfer Connectors (thin dotted lines) — only in all-mode view */}
          {showTransfers && (
            <g id="transfer-connectors">
              {transfersData.map((tr, idx) => {
                const s1 = stopsById.get(tr.from_stop_id);
                const s2 = stopsById.get(tr.to_stop_id);
                if (!s1 || !s2 || tr.from_stop_id > tr.to_stop_id) return null;

                const isPartOfActiveTrip = journeyStopIds.includes(tr.from_stop_id) && journeyStopIds.includes(tr.to_stop_id);

                return (
                  <g key={`tr-${idx}`}>
                    <line
                      x1={s1.schematic_x}
                      y1={s1.schematic_y}
                      x2={s2.schematic_x}
                      y2={s2.schematic_y}
                      stroke={isPartOfActiveTrip ? '#38BDF8' : '#94A3B8'}
                      strokeWidth={isPartOfActiveTrip ? '4' : '2'}
                      strokeDasharray="4 4"
                      opacity={isPartOfActiveTrip ? 1 : 0.5}
                    />
                    <rect
                      x={(s1.schematic_x + s2.schematic_x) / 2 - 25}
                      y={(s1.schematic_y + s2.schematic_y) / 2 - 8}
                      width="50"
                      height="16"
                      rx="4"
                      fill="var(--bg-station)"
                      stroke="var(--border-board)"
                      strokeWidth="1"
                    />
                    <text
                      x={(s1.schematic_x + s2.schematic_x) / 2}
                      y={(s1.schematic_y + s2.schematic_y) / 2 + 4}
                      fill="#CBD5E1"
                      fontSize="9.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {tr.walking_distance_m}m
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* 4. Base Transit Network Lines */}
          {isModeVisible('metro') && metroSegments.map(({ edge, from, to }) => {
            const color = edge.line_id === 'LINE_METRO_EW' ? '#3B82F6'
              : edge.line_id === 'LINE_METRO_NS' ? '#EF4444' : '#8B5CF6';
            return <line key={`${edge.line_id}-${edge.from_stop_id}-${edge.to_stop_id}`}
              x1={from.schematic_x} y1={from.schematic_y} x2={to.schematic_x} y2={to.schematic_y}
              stroke={color} strokeWidth="8" strokeLinecap="round"
              opacity={selectedJourney ? 0.35 : 0.85} />;
          })}

          {/* BRTS Janmarg Trunk Lines (Emerald Green) */}
          {isModeVisible('brts') && (
            <>
              {/* West Ring: Ghuma -> Bopal -> ISKCON -> Shivranjani -> Jaymangal -> Ranip -> RTO */}
              <path
                d="M 60 720 L 320 720 L 390 390 L 460 310 L 460 220"
                stroke="#10B981"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                markerMid="url(#brts-chevron)"
                fill="none"
                opacity={selectedJourney ? 0.35 : 0.8}
              />
              {/* Central Trunk: Old High Court -> Townhall -> Geeta Mandir -> Maninagar */}
              <path
                d="M 460 310 L 460 560 L 620 650 L 820 720 L 1000 730"
                stroke="#10B981"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={selectedJourney ? 0.35 : 0.8}
              />
              {/* Kalupur Radial & Naroda Connect */}
              <path
                d="M 900 500 L 820 720"
                stroke="#10B981"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={selectedJourney ? 0.3 : 0.75}
              />
              <path
                d="M 900 500 L 1240 380"
                stroke="#10B981"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={selectedJourney ? 0.3 : 0.75}
              />
            </>
          )}

          {/* AMTS Feeder Network (Amber Dashed Lines) */}
          {isModeVisible('amts') && (
            <>
              <path
                d="M 140 440 L 140 560"
                stroke="#F59E0B"
                strokeWidth="5"
                strokeDasharray="8 6"
                fill="none"
                opacity={selectedJourney ? 0.35 : 0.85}
              />
              <path
                d="M 320 620 L 410 630 L 730 640 L 820 720 L 920 720"
                stroke="#F59E0B"
                strokeWidth="5"
                strokeDasharray="8 6"
                fill="none"
                opacity={selectedJourney ? 0.35 : 0.85}
              />
              <path
                d="M 460 90 L 460 220"
                stroke="#F59E0B"
                strokeWidth="5"
                strokeDasharray="8 6"
                fill="none"
                opacity={selectedJourney ? 0.35 : 0.85}
              />
            </>
          )}

          {/* 5. Highlight each ride and walking transfer as its own path */}
          {activeLegPaths.map(leg => (
            <g key={`${journeyKey}-${leg.key}`} className={`active-map-leg ${leg.type}`} style={{ '--leg-color': leg.color }}>
              <path
                d={leg.d}
                pathLength={leg.type === 'ride' ? '1' : undefined}
                stroke={leg.color}
                strokeWidth={leg.type === 'transfer' ? '10' : '18'}
                strokeDasharray={leg.type === 'transfer' ? '8 7' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                className="active-route-halo"
              />
              <path
                d={leg.d}
                pathLength={leg.type === 'ride' ? '1' : undefined}
                stroke={leg.color}
                strokeWidth={leg.type === 'transfer' ? '4' : '8'}
                strokeDasharray={leg.type === 'transfer' ? '8 7' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                className={leg.type === 'ride' ? 'animated-route-line active-route-core' : 'active-route-core'}
              />
              {leg.type === 'ride' && <path
                d={leg.d}
                pathLength="1"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                className="active-route-centerline"
              />}
            </g>
          ))}

          {/* 6. Stations, Interchange Hubs, and Non-Overlapping Labels (filtered by mode) */}
          {stopsData.filter(isStationVisible).map(stop => {
            const isSelectedOrigin = selectedJourney && selectedJourney.originStop.stop_id === stop.stop_id;
            const isSelectedDest = selectedJourney && selectedJourney.destStop.stop_id === stop.stop_id;
            const isTripStop = journeyStopIds.includes(stop.stop_id);
            const isInterchange = stop.is_interchange;

            // Stop Mode Colors
            const modeColor = stop.transport_mode === 'metro'
              ? (stop.line_id === 'LINE_METRO_GANDHINAGAR' ? '#8B5CF6' : (stop.line_id === 'LINE_METRO_NS' ? '#EF4444' : '#3B82F6'))
              : stop.transport_mode === 'brts' ? '#10B981' : '#F59E0B';

            // Smart label positioning based on orientation
            let labelX = stop.schematic_x;
            let labelY = stop.schematic_y - 14;
            let textAnchor = 'middle';

            if (stop.label_pos === 'bottom') {
              labelY = stop.schematic_y + 20;
            } else if (stop.label_pos === 'right') {
              labelX = stop.schematic_x + 14;
              labelY = stop.schematic_y + 4;
              textAnchor = 'start';
            } else if (stop.label_pos === 'left') {
              labelX = stop.schematic_x - 14;
              labelY = stop.schematic_y + 4;
              textAnchor = 'end';
            } else if (stop.label_pos === 'top-right') {
              labelX = stop.schematic_x + 14;
              labelY = stop.schematic_y - 12;
              textAnchor = 'start';
            } else if (stop.label_pos === 'bottom-left') {
              labelX = stop.schematic_x - 14;
              labelY = stop.schematic_y + 18;
              textAnchor = 'end';
            }

            return (
              <g
                key={stop.stop_id}
                className="station-node-group"
                onClick={() => onSelectStation(stop)}
                onMouseEnter={() => setHoveredStation(stop)}
                onMouseLeave={() => setHoveredStation(null)}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
              >
                {/* Station Node Graphic */}
                {isInterchange ? (
                  <>
                    <circle
                      cx={stop.schematic_x}
                      cy={stop.schematic_y}
                      r={isTripStop ? 11 : 9}
                      fill="#060B18"
                      stroke="#FFFFFF"
                      strokeWidth="3.5"
                    />
                    <circle
                      cx={stop.schematic_x}
                      cy={stop.schematic_y}
                      r={isTripStop ? 5.5 : 4}
                      fill={modeColor}
                    />
                  </>
                ) : (
                  <circle
                    cx={stop.schematic_x}
                    cy={stop.schematic_y}
                    r={isTripStop ? 7.5 : 5}
                    fill={isTripStop ? '#FFFFFF' : '#070D1E'}
                    stroke={modeColor}
                    strokeWidth="3"
                  />
                )}

                {/* Origin Marker Pulsing Ring */}
                {isSelectedOrigin && (
                  <circle
                    cx={stop.schematic_x}
                    cy={stop.schematic_y}
                    r="16"
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="3.5"
                    strokeDasharray="4 3"
                  />
                )}

                {/* Destination Marker Solid Pin */}
                {isSelectedDest && (
                  <circle
                    cx={stop.schematic_x}
                    cy={stop.schematic_y}
                    r="15"
                    fill="#EF4444"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />
                )}

                {/* Text Label with readable background contrast halo */}
                <g opacity={isTripStop ? 1 : 0.85}>
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor={textAnchor}
                    fill={isTripStop ? '#FFFFFF' : '#E2E8F0'}
                    fontSize={isInterchange ? '11.5' : '10.5'}
                    fontWeight={isTripStop || isInterchange ? '700' : '500'}
                    fontFamily="system-ui, -apple-system, sans-serif"
                    style={{
                      textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 2px #060B18'
                    }}
                  >
                    {activeLang === 'gu' && stop.stop_name_gu ? stop.stop_name_gu : stop.stop_name}
                  </text>
                  {activeLang === 'bilingual' && stop.stop_name_gu && (
                    <text
                      x={labelX}
                      y={labelY + 11}
                      textAnchor={textAnchor}
                      fill={isTripStop ? '#93C5FD' : '#94A3B8'}
                      fontSize="9.5"
                      fontFamily="system-ui, sans-serif"
                      style={{
                        textShadow: '0 1px 3px rgba(0,0,0,0.8)'
                      }}
                    >
                      {stop.stop_name_gu}
                    </text>
                  )}
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Modern Transit Map Legend (Corner Overlay) */}
      <div className="map-legend">
        <div className="map-legend-title">
          Ahmedabad Transit Corridors
        </div>
        <div className="map-legend-grid">
          <span style={{ width: 14, height: 4, background: '#3B82F6', borderRadius: 2 }} />
          <span>Metro East-West (Thaltej ➔ Vastral)</span>

          <span style={{ width: 14, height: 4, background: '#EF4444', borderRadius: 2 }} />
          <span>Metro North-South (APMC ➔ Motera)</span>

          <span style={{ width: 14, height: 4, background: '#8B5CF6', borderRadius: 2 }} />
          <span>Metro Phase 2 (GIFT City & Gandhinagar)</span>

          <span style={{ width: 14, height: 4, background: '#10B981', borderRadius: 2 }} />
          <span>Janmarg BRTS Trunk Network</span>

          <span style={{ width: 14, height: 4, background: '#F59E0B', borderTop: '1px dashed #F59E0B' }} />
          <span>AMTS City Feeder Lines</span>

          <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #FFFFFF', background: '#060B18' }} />
          <span>Multimodal Interchange Hub</span>

          <span style={{ width: 14, height: 4, background: '#0284C7', borderRadius: 2 }} />
          <span>Sabarmati River Ribbon</span>
        </div>
      </div>
    </div>
  );
}
