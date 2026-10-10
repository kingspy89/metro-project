import React from 'react';
import { stopsById } from '../engine/graph.js';
import { Train, Bus, Footprints, AlertTriangle, ArrowRight } from 'lucide-react';

export default function JourneyTimeline({ journey }) {
  if (!journey) return null;

  let stepNumber = 1;

  return (
    <div className="timeline-section" id="journey-timeline-section">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-bright)' }}>
          Announcement Timeline
        </h3>
        <span className="config-tag">
          Configured estimate · Offline timetable
        </span>
      </div>

      {journey.legs.map((leg, idx) => {
        const fromStop = stopsById.get(leg.fromStop);
        const toStop = stopsById.get(leg.toStop);

        if (leg.type === 'transfer') {
          const currentStep = stepNumber++;
          return (
            <div key={`leg-${idx}`} className="timeline-step">
              <div className="step-num-badge walk">
                <Footprints size={18} />
              </div>

              <div className="step-main">
                <div className="step-instruction">
                  Alight at {fromStop?.stop_name}. Walk {leg.walkingDistanceM} m to {toStop?.stop_name}
                </div>
                <div className="step-meta">
                  <span>~{leg.durationMinutes} min transfer</span>
                  <span className="config-tag">configured distance</span>
                  {leg.isLongWalk && (
                    <span className="mind-gap-alert">
                      <AlertTriangle size={14} /> Mind the gap: Long walk ahead ({leg.walkingDistanceM} m)
                    </span>
                  )}
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Step {currentStep}
              </div>
            </div>
          );
        }

        // Ride Leg
        const currentStep = stepNumber++;
        const modeBadgeClass = leg.mode;
        const ModeIcon = leg.mode === 'metro' ? Train : Bus;

        return (
          <div key={`leg-${idx}`} className="timeline-step">
            <div className={`step-num-badge ${modeBadgeClass}`}>
              <ModeIcon size={18} />
            </div>

            <div className="step-main">
              <div className="step-instruction">
                Board {leg.mode.toUpperCase()} at {fromStop?.stop_name} — ride {leg.stopCount} {leg.stopCount === 1 ? 'stop' : 'stops'} to {toStop?.stop_name}
              </div>
              <div className="step-meta">
                <span>⏱ {leg.durationMinutes} min in-vehicle</span>
                <span>•</span>
                <span>📏 {leg.distanceKm?.toFixed(1)} km</span>
                <span>•</span>
                <span>Standalone est: ₹{leg.fare.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Step {currentStep}
            </div>
          </div>
        );
      })}
    </div>
  );
}
