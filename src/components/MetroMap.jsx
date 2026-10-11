import React, { useState, useRef, useEffect } from 'react';
import stopsData from '../data/stops.json' with { type: 'json' };
import linesData from '../data/lines.json' with { type: 'json' };
import transfersData from '../data/transfers.json' with { type: 'json' };
import connectionsData from '../data/connections.json' with { type: 'json' };
import busPatterns from '../data/gtfs_bus_patterns.json' with { type: 'json' };
import busStopIds from '../data/gtfs_bus_stop_ids.json' with { type: 'json' };
import sabarmatiRiver from '../data/sabarmati_river.json' with { type: 'json' };
import transitData from '../data/gtfs_metadata.json' with { type: 'json' };
const stopsById = new Map(stopsData.map(stop => [stop.stop_id, stop]));
const geoStops = stopsData.filter(stop => stop.source === 'community_gtfs');
const geoBounds = {
  minLon: Math.min(...geoStops.map(stop => stop.longitude)),
  maxLon: Math.max(...geoStops.map(stop => stop.longitude)),
  minLat: Math.min(...geoStops.map(stop => stop.latitude)),
  maxLat: Math.max(...geoStops.map(stop => stop.latitude)),
};
const toMapPoint = ({ lon, lat }) => ({
  x: 80 + (lon - geoBounds.minLon) / (geoBounds.maxLon - geoBounds.minLon) * 1480,
  y: 80 + (geoBounds.maxLat - lat) / (geoBounds.maxLat - geoBounds.minLat) * 820,
});
const sabarmatiPaths = sabarmatiRiver.paths.map(path => path.map(toMapPoint));
const sabarmatiPathD = sabarmatiPaths.map(path => `M ${path.map(point => `${point.x},${point.y}`).join(' L ')}`).join(' ');
const riverLabelPoint = sabarmatiRiver.paths.flat().reduce((best, point) =>
  Math.hypot(point.lon - 72.58, point.lat - 23.03) < Math.hypot(best.lon - 72.58, best.lat - 23.03) ? point : best
);
const riverLabelPosition = toMapPoint(riverLabelPoint);
const brtsRouteCount = new Set(linesData.filter(line => line.mode === 'brts').map(line => line.route_id)).size;
const amtsRouteCount = new Set(linesData.filter(line => line.mode === 'amts').map(line => line.route_id)).size;
const metroSegments = connectionsData
  .filter(edge => edge.transport_mode === 'metro' && edge.from_stop_id < edge.to_stop_id)
  .map(edge => ({ edge, from: stopsById.get(edge.from_stop_id), to: stopsById.get(edge.to_stop_id) }))
  .filter(({ from, to }) => from && to);
const gtfsBusLines = linesData.filter(line => line.source === 'community_gtfs');
const simplifyRoutePoints = (points, tolerance = 2) => {
  if (points.length <= 2) return points;
  const toleranceSquared = tolerance * tolerance;
  const kept = new Uint8Array(points.length);
  kept[0] = 1;
  kept[points.length - 1] = 1;
  const ranges = [[0, points.length - 1]];

  while (ranges.length) {
    const [start, end] = ranges.pop();
    const first = points[start];
    const last = points[end];
    const dx = last.schematic_x - first.schematic_x;
    const dy = last.schematic_y - first.schematic_y;
    const lineLengthSquared = dx * dx + dy * dy;
    let farthestIndex = -1;
    let farthestDistanceSquared = toleranceSquared;

    for (let index = start + 1; index < end; index++) {
      const point = points[index];
      const projection = lineLengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
        ((point.schematic_x - first.schematic_x) * dx + (point.schematic_y - first.schematic_y) * dy) / lineLengthSquared
      ));
      const nearestX = first.schematic_x + projection * dx;
      const nearestY = first.schematic_y + projection * dy;
      const deltaX = point.schematic_x - nearestX;
      const deltaY = point.schematic_y - nearestY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      if (distanceSquared > farthestDistanceSquared) {
        farthestDistanceSquared = distanceSquared;
        farthestIndex = index;
      }
    }

    if (farthestIndex !== -1) {
      kept[farthestIndex] = 1;
      ranges.push([start, farthestIndex], [farthestIndex, end]);
    }
  }

  return points.filter((_, index) => kept[index]);
};
const busRoutePaths = busPatterns.map(([lineIndex, directionId, stopIndexes]) => {
  const route = gtfsBusLines[lineIndex];
  const points = simplifyRoutePoints(stopIndexes.map(index => stopsById.get(busStopIds[index])).filter(Boolean));
  return {
    key: `${route?.line_id}-${directionId}`,
    mode: route?.mode,
    lineId: route?.line_id,
    d: points.length > 1 ? `M ${points.map(stop => `${stop.schematic_x},${stop.schematic_y}`).join(' L ')}` : ''
  };
}).filter(pattern => pattern.d && (pattern.mode === 'brts' || pattern.mode === 'amts'));
const TransitNetworkLayer = React.memo(function TransitNetworkLayer({ filterMode, hasJourney }) {
  const isModeVisible = mode => filterMode !== 'route_only' && (filterMode === 'all' || filterMode === mode);
  return <>
    {isModeVisible('metro') && metroSegments.map(({ edge, from, to }) => {
      const color = edge.line_id === 'LINE_METRO_EW' ? '#3B82F6'
        : edge.line_id === 'LINE_METRO_NS' ? '#EF4444' : '#8B5CF6';
      return <line key={`${edge.line_id}-${edge.from_stop_id}-${edge.to_stop_id}`}
        x1={from.schematic_x} y1={from.schematic_y} x2={to.schematic_x} y2={to.schematic_y}
        stroke={color} strokeWidth="8" strokeLinecap="round"
        opacity={hasJourney ? 0.22 : 0.78} />;
    })}
    {busRoutePaths.filter(route => isModeVisible(route.mode)).map(route => (
      <path key={route.key} d={route.d} fill="none"
        stroke={route.mode === 'brts' ? '#10B981' : '#F59E0B'}
        strokeWidth={route.mode === 'brts' ? 1.25 : 1.05}
        strokeLinecap="round" strokeLinejoin="round"
        opacity={hasJourney ? (route.mode === 'brts' ? 0.09 : 0.075) : route.mode === 'brts' ? 0.12 : 0.09} />
    ))}
  </>;
});
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw
} from 'lucide-react';

export default function MetroMap({ selectedJourney, onSelectStation, activeLang = 'bilingual' }) {
  const [isDragging, setIsDragging] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'metro', 'brts', 'amts', 'route_only'
  const svgRef = useRef(null);
  const mapWrapperRef = useRef(null);
  const hoverTooltipRef = useRef(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });

  const applyMapTransform = () => {
    if (!svgRef.current) return;
    const { x, y } = panRef.current;
    svgRef.current.style.transform = `translate(${x}px, ${y}px) scale(${zoomRef.current})`;
  };

  const positionHoverTooltip = (clientX, clientY) => {
    const tooltip = hoverTooltipRef.current;
    const wrapper = mapWrapperRef.current;
    if (!tooltip || !wrapper || tooltip.style.display === 'none') return;
    const bounds = wrapper.getBoundingClientRect();
    const left = Math.min(clientX - bounds.left + 14, bounds.width - tooltip.offsetWidth - 8);
    const top = Math.min(clientY - bounds.top + 14, bounds.height - tooltip.offsetHeight - 8);
    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  };

  const showStationTooltip = (event, stop) => {
    const tooltip = hoverTooltipRef.current;
    if (!tooltip) return;
    const name = activeLang === 'gu' && stop.stop_name_gu ? stop.stop_name_gu : stop.stop_name;
    tooltip.textContent = `${name} · ${stop.transport_mode.toUpperCase()}${stop.route_count ? ` · ${stop.route_count} routes` : ''}`;
    tooltip.style.display = 'block';
    positionHoverTooltip(event.clientX, event.clientY);
  };

  const hideStationTooltip = () => {
    if (hoverTooltipRef.current) hoverTooltipRef.current.style.display = 'none';
  };

  // Collect stops in active journey
  const journeyStopIds = [];
  const journeyStopSet = new Set();
  const routeEndpointIds = new Set();
  const addJourneyStop = stopId => {
    if (journeyStopSet.has(stopId)) return;
    journeyStopSet.add(stopId);
    journeyStopIds.push(stopId);
  };
  if (selectedJourney) {
    for (const leg of selectedJourney.legs) {
      routeEndpointIds.add(leg.fromStop);
      routeEndpointIds.add(leg.toStop);
      addJourneyStop(leg.fromStop);
      if (leg.intermediateStops) {
        for (const mid of leg.intermediateStops) addJourneyStop(mid);
      }
      addJourneyStop(leg.toStop);
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
        panRef.current = {
          x: (800 - midX) * 0.5,
          y: (480 - midY) * 0.5
        };
        applyMapTransform();
      }
    }
  }, [journeyKey]);

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
    zoomRef.current = Math.min(2.8, Math.max(0.65, zoomRef.current * zoomFactor));
    applyMapTransform();
  };

  // Mouse drag handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('.station-node-group') || e.target.closest('.map-control-btn')) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - panRef.current.x,
      y: e.clientY - panRef.current.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    panRef.current = {
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    };
    applyMapTransform();
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    hideStationTooltip();
  };

  const handleResetView = () => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    applyMapTransform();
  };

  const handleZoomBy = factor => {
    zoomRef.current = Math.min(2.8, Math.max(0.65, zoomRef.current * factor));
    applyMapTransform();
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

  // Only show transfers when all modes are visible (multi-mode context)
  const showTransfers = filterMode === 'all' || filterMode === 'route_only';

  return (
    <div className="metro-map-wrapper" ref={mapWrapperRef}>
      {/* Map Interactive Toolbar */}
      <div className="map-toolbar">
        <button
          className="map-control-btn"
          onClick={() => handleZoomBy(1.2)}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn size={18} />
        </button>
        <button
          className="map-control-btn"
          onClick={() => handleZoomBy(0.82)}
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
            transform: 'translate(0px, 0px) scale(1)',
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

          <g className="map-area-labels" aria-hidden="true">
            <text x="245" y="475">WEST AHMEDABAD</text>
            <text x="770" y="455">OLD CITY</text>
            <text x="1265" y="470">EAST AHMEDABAD</text>
            <text x="1265" y="125">GANDHINAGAR</text>
          </g>

          {/* 2. Sabarmati River Water Ribbon (Meandering geographic landmark) */}
          <g id="sabarmati-river-corridor">
            <path d={sabarmatiPathD} stroke="url(#river-gradient)" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".6" />
            <path d={sabarmatiPathD} stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".72" />
            <text x={riverLabelPosition.x + 12} y={riverLabelPosition.y - 8} className="river-map-label">SABARMATI RIVER · સાબરમતી નદી</text>
          </g>

          {/* 3. Walking Transfer Connectors (thin dotted lines) — only in all-mode view */}
          {showTransfers && (
            <g id="transfer-connectors">
              {transfersData.map((tr, idx) => {
                const s1 = stopsById.get(tr.from_stop_id);
                const s2 = stopsById.get(tr.to_stop_id);
                if (!s1 || !s2 || tr.from_stop_id > tr.to_stop_id) return null;

                const isPartOfActiveTrip = journeyStopSet.has(tr.from_stop_id) && journeyStopSet.has(tr.to_stop_id);

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
          {/* Memoized corridor layer avoids rebuilding more than 900 route paths on hover and zoom. */}
          <TransitNetworkLayer filterMode={filterMode} hasJourney={Boolean(selectedJourney)} />

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
            const isTripStop = journeyStopSet.has(stop.stop_id);
            const isRouteEndpoint = routeEndpointIds.has(stop.stop_id);
            const isInterchange = stop.is_interchange;
            const isAmtsStop = stop.transport_mode === 'amts';
            const showLabel = selectedJourney && isRouteEndpoint;
            const dotOpacity = isTripStop ? 1
              : stop.transport_mode === 'metro' ? 0.88
                : isInterchange ? 0.72 : 0.42;

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
                opacity={dotOpacity}
                onClick={() => onSelectStation(stop)}
                onMouseEnter={event => showStationTooltip(event, stop)}
                onMouseLeave={hideStationTooltip}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
              >
                <title>{stop.stop_name} · {stop.transport_mode.toUpperCase()}{stop.route_count ? ` · ${stop.route_count} routes` : ''}</title>
                {isAmtsStop && <circle cx={stop.schematic_x} cy={stop.schematic_y} r="8" fill="transparent" />}
                {!isAmtsStop && <>
                {/* Station Node Graphic */}
                  {stop.transport_mode === 'metro' && isInterchange ? (
                  <>
                    <circle
                      cx={stop.schematic_x}
                      cy={stop.schematic_y}
                      r={isRouteEndpoint ? 7 : isTripStop ? 4.5 : 3.1}
                      fill="#060B18"
                      stroke={isRouteEndpoint ? '#FFFFFF' : modeColor}
                      strokeWidth={isRouteEndpoint ? '2.5' : '1.4'}
                    />
                    <circle
                      cx={stop.schematic_x}
                      cy={stop.schematic_y}
                      r={isRouteEndpoint ? 3.2 : isTripStop ? 2.2 : 1.6}
                      fill={modeColor}
                    />
                  </>
                ) : (
                    <circle
                    cx={stop.schematic_x}
                    cy={stop.schematic_y}
                      r={isRouteEndpoint ? 5.2 : isTripStop ? 3.7 : stop.transport_mode === 'metro' ? 2.8 : isInterchange ? 2.4 : 1.35}
                    fill={isTripStop ? '#FFFFFF' : '#070D1E'}
                    stroke={modeColor}
                      strokeWidth={isRouteEndpoint ? 2.1 : isTripStop ? 1.5 : stop.transport_mode === 'metro' ? 1.4 : isInterchange ? 1.2 : 0.7}
                  />
                )}

                {/* Origin Marker Pulsing Ring */}
                {isSelectedOrigin && (
                  <circle
                    cx={stop.schematic_x}
                    cy={stop.schematic_y}
                    r="10"
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="2.5"
                    strokeDasharray="4 3"
                  />
                )}

                {/* Destination Marker Solid Pin */}
                {isSelectedDest && (
                  <circle
                    cx={stop.schematic_x}
                    cy={stop.schematic_y}
                    r="9"
                    fill="#EF4444"
                    stroke="#FFFFFF"
                    strokeWidth="2.2"
                  />
                )}
                </>}

                {/* Text Label with readable background contrast halo */}
                {showLabel && <g opacity={isTripStop ? 1 : 0.85}>
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor={textAnchor}
                    fill={isTripStop ? '#FFFFFF' : '#E2E8F0'}
                    fontSize={selectedJourney ? '13' : isInterchange ? '11.5' : '10.5'}
                    fontWeight={selectedJourney || isTripStop || isInterchange ? '700' : '500'}
                    fontFamily="system-ui, -apple-system, sans-serif"
                    style={{
                    textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 2px #060B18',
                    paintOrder: 'stroke',
                    stroke: '#071018',
                    strokeWidth: selectedJourney ? 5 : 3,
                    strokeLinejoin: 'round'
                    }}
                  >
                    {activeLang === 'gu' && stop.stop_name_gu ? stop.stop_name_gu : stop.stop_name}
                  </text>
                  {!selectedJourney && activeLang === 'bilingual' && stop.stop_name_gu && (
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
                </g>}
              </g>
            );
          })}
        </svg>
      </div>

      <div ref={hoverTooltipRef} className="map-hover-tooltip" role="tooltip" style={{ display: 'none' }} />

      {/* Modern Transit Map Legend (Corner Overlay) */}
      <div className={`map-legend${selectedJourney ? ' map-legend-route-focus' : ''}`}>
        <div className="map-legend-title">
          {selectedJourney ? (activeLang === 'gu' ? 'તમારો પસંદ કરેલો માર્ગ' : 'Selected route') : 'Ahmedabad Transit Corridors'}
          {!selectedJourney && <small style={{ display: 'block', marginTop: 3, color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 500 }}>
            Static bus feed through {transitData.validity_end.slice(0, 4)}-{transitData.validity_end.slice(4, 6)}-{transitData.validity_end.slice(6)}
          </small>}
        </div>
        <div className="map-legend-grid">
          {selectedJourney ? <>
            {selectedJourney.modesUsed.map(mode => <React.Fragment key={mode}>
              <span style={{ width: 14, height: 4, background: mode === 'metro' ? '#3B82F6' : mode === 'brts' ? '#10B981' : '#F59E0B', borderRadius: 2 }} />
              <span>{mode.toUpperCase()}</span>
            </React.Fragment>)}
            <span style={{ gridColumn: '1 / -1', color: 'var(--text-muted)' }}>Only boarding, transfer, and destination stops are labeled.</span>
          </> : <>
          <span style={{ width: 14, height: 4, background: '#3B82F6', borderRadius: 2 }} />
          <span>Metro East-West (Thaltej ➔ Vastral)</span>

          <span style={{ width: 14, height: 4, background: '#EF4444', borderRadius: 2 }} />
          <span>Metro North-South (APMC ➔ Motera)</span>

          <span style={{ width: 14, height: 4, background: '#8B5CF6', borderRadius: 2 }} />
          <span>Metro Phase 2 (GIFT City & Gandhinagar)</span>

          <span style={{ width: 14, height: 4, background: '#10B981', borderRadius: 2 }} />
          <span>Janmarg BRTS · {brtsRouteCount} routes</span>

          <span style={{ width: 14, height: 4, background: '#F59E0B', borderTop: '1px dashed #F59E0B' }} />
          <span>AMTS · {amtsRouteCount} routes</span>

          <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #FFFFFF', background: '#060B18' }} />
          <span>Multimodal Interchange Hub</span>

          <span style={{ width: 14, height: 4, background: 'rgba(255,255,255,.32)', borderRadius: 2 }} />
          <span>Faint lines show bus routes · hover for a stop name</span>
          </>}
        </div>
        <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · river geometry</a>
      </div>
    </div>
  );
}

