import React, { useState } from 'react';
import stopsData from '../data/stops.json' with { type: 'json' };
import linesData from '../data/lines.json' with { type: 'json' };
import transfersData from '../data/transfers.json' with { type: 'json' };
import { stopsById } from '../engine/graph.js';
import { Footprints, Train, Bus, Info } from 'lucide-react';

export default function MetroMap({ selectedJourney, onSelectStation, activeLang = 'en' }) {
  const [hoveredStation, setHoveredStation] = useState(null);

  // Group stops by line to render background network lines
  const metroStops = stopsData.filter(s => s.transport_mode === 'metro');
  const brtsStops = stopsData.filter(s => s.transport_mode === 'brts');
  const amtsStops = stopsData.filter(s => s.transport_mode === 'amts');

  // Build route path coordinates for the selected journey
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

  // Create SVG path string for the selected active trip
  const activePathPoints = journeyStopIds
    .map(id => stopsById.get(id))
    .filter(Boolean)
    .map(s => `${s.schematic_x},${s.schematic_y}`);
  
  const activePathD = activePathPoints.length > 0 ? `M ${activePathPoints.join(' L ')}` : '';

  return (
    <div className="schematic-svg-container" id="metro-map-container">
      <svg
        viewBox="0 0 1100 550"
        className="metro-svg"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Schematic Multimodal Metro Map of Ahmedabad"
      >
        <defs>
          {/* Chevron marker for BRTS */}
          <marker
            id="chevron"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 5 5 L 0 9" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
          </marker>

          {/* Glow filter */}
          <filter id="active-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#38BDF8" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* 1. Background Grid / Guide Lines */}
        <g opacity="0.04" stroke="#FFFFFF" strokeWidth="1">
          <line x1="0" y1="30" x2="1100" y2="30" />
          <line x1="0" y1="300" x2="1100" y2="300" />
          <line x1="0" y1="420" x2="1100" y2="420" />
          <line x1="420" y1="0" x2="420" y2="550" />
        </g>

        {/* 2. Walking Transfer Connectors (thin dotted lines) */}
        <g id="transfer-connectors">
          {transfersData.map((tr, idx) => {
            const s1 = stopsById.get(tr.from_stop_id);
            const s2 = stopsById.get(tr.to_stop_id);
            if (!s1 || !s2 || tr.from_stop_id > tr.to_stop_id) return null; // draw once per pair

            const isPartOfActiveTrip = journeyStopIds.includes(tr.from_stop_id) && journeyStopIds.includes(tr.to_stop_id);

            return (
              <g key={`tr-${idx}`}>
                <line
                  x1={s1.schematic_x}
                  y1={s1.schematic_y}
                  x2={s2.schematic_x}
                  y2={s2.schematic_y}
                  stroke={isPartOfActiveTrip ? '#38BDF8' : '#94A3B8'}
                  strokeWidth={isPartOfActiveTrip ? '3.5' : '2'}
                  strokeDasharray="4 4"
                  opacity={isPartOfActiveTrip ? 1 : 0.6}
                />
                <text
                  x={(s1.schematic_x + s2.schematic_x) / 2 + 10}
                  y={(s1.schematic_y + s2.schematic_y) / 2}
                  fill="#94A3B8"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {tr.walking_distance_m}m · {tr.walking_time_minutes}m
                </text>
              </g>
            );
          })}
        </g>

        {/* 3. Base Transit Network Lines */}
        {/* Metro East-West Line (Thick Solid Blue) */}
        <path
          d="M 60 300 L 1030 300"
          stroke="#3B82F6"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.6"
        />

        {/* Metro North-South Line (Solid Red) */}
        <path
          d="M 420 30 L 420 510"
          stroke="#EF4444"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.6"
        />

        {/* Metro Gandhinagar Extension (Purple Line) */}
        <path
          d="M 420 30 L 1060 30"
          stroke="#8B5CF6"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.6"
        />

        {/* GIFT City Branch */}
        <path
          d="M 750 30 L 780 75 L 850 75"
          stroke="#8B5CF6"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.6"
        />

        {/* BRTS Trunk: Outer & Central Radial Corridors (Emerald Green) */}
        <path
          d="M 30 420 L 240 420 L 310 200 L 380 155 L 380 110"
          stroke="#10B981"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          markerMid="url(#chevron)"
          fill="none"
          opacity="0.55"
        />
        <path
          d="M 380 155 L 370 300 L 480 370 L 620 420 L 740 430"
          stroke="#10B981"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.55"
        />
        <path
          d="M 660 250 L 620 420"
          stroke="#10B981"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.5"
        />
        <path
          d="M 660 250 L 880 160"
          stroke="#10B981"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.5"
        />

        {/* AMTS Feeders (Amber Dashed Lines) */}
        <path
          d="M 60 200 L 110 300"
          stroke="#F59E0B"
          strokeWidth="4"
          strokeDasharray="7 5"
          fill="none"
          opacity="0.6"
        />
        <path
          d="M 260 350 L 330 350 L 550 350 L 620 420 L 680 450"
          stroke="#F59E0B"
          strokeWidth="4"
          strokeDasharray="7 5"
          fill="none"
          opacity="0.6"
        />
        <path
          d="M 470 10 L 380 110"
          stroke="#F59E0B"
          strokeWidth="4"
          strokeDasharray="7 5"
          fill="none"
          opacity="0.6"
        />

        {/* 4. Active Selected Trip Highlight Line with Draw Animation */}
        {activePathD && (
          <path
            d={activePathD}
            stroke="#38BDF8"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#active-glow)"
            className="animated-route-line"
          />
        )}

        {/* 5. Station Ticks, Interchanges, and Nodes */}
        {stopsData.map(stop => {
          const isSelectedOrigin = selectedJourney && selectedJourney.originStop.stop_id === stop.stop_id;
          const isSelectedDest = selectedJourney && selectedJourney.destStop.stop_id === stop.stop_id;
          const isInterchange = stop.is_interchange;
          const isTripStop = journeyStopIds.includes(stop.stop_id);

          return (
            <g
              key={stop.stop_id}
              className="station-node-group"
              onClick={() => onSelectStation(stop)}
              onMouseEnter={() => setHoveredStation(stop)}
              onMouseLeave={() => setHoveredStation(null)}
              role="button"
              tabIndex={0}
              aria-label={`${stop.stop_name} station`}
            >
              {/* Interchange Ring or Regular Tick */}
              {isInterchange ? (
                <>
                  <circle
                    cx={stop.schematic_x}
                    cy={stop.schematic_y}
                    r={isTripStop ? 10 : 8}
                    fill="#060B18"
                    stroke="#FFFFFF"
                    strokeWidth="3.5"
                  />
                  <circle
                    cx={stop.schematic_x}
                    cy={stop.schematic_y}
                    r={isTripStop ? 5 : 3.5}
                    fill={stop.transport_mode === 'metro' ? '#3B82F6' : stop.transport_mode === 'brts' ? '#10B981' : '#F59E0B'}
                  />
                </>
              ) : (
                <circle
                  cx={stop.schematic_x}
                  cy={stop.schematic_y}
                  r={isTripStop ? 7 : 5}
                  fill={isTripStop ? '#FFFFFF' : '#060B18'}
                  stroke={stop.transport_mode === 'metro' ? '#3B82F6' : stop.transport_mode === 'brts' ? '#10B981' : '#F59E0B'}
                  strokeWidth="3"
                />
              )}

              {/* Origin Marker: Hollow Accent Circle */}
              {isSelectedOrigin && (
                <circle
                  cx={stop.schematic_x}
                  cy={stop.schematic_y}
                  r="14"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="3"
                  strokeDasharray="4 2"
                />
              )}

              {/* Destination Marker: Filled Pin Dot */}
              {isSelectedDest && (
                <circle
                  cx={stop.schematic_x}
                  cy={stop.schematic_y}
                  r="13"
                  fill="#EF4444"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                />
              )}

              {/* Bilingual Labels (English + Gujarati) */}
              <text
                x={stop.schematic_x + 8}
                y={stop.schematic_y - 12}
                className="station-text-en"
                fontWeight={isTripStop ? '700' : '500'}
                fill={isTripStop ? '#FFFFFF' : '#94A3B8'}
              >
                {activeLang === 'gu' && stop.stop_name_gu ? stop.stop_name_gu : stop.stop_name}
              </text>
              {activeLang === 'bilingual' && (
                <text
                  x={stop.schematic_x + 8}
                  y={stop.schematic_y + 18}
                  className="station-text-gu"
                  fill="#64748B"
                >
                  {stop.stop_name_gu}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
