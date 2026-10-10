import React from 'react';
import { Train, Bus, Footprints, Clock, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export default function DepartureBoard({ journeys, selectedJourney, onSelectJourney, preference, isSingleRouteOnly }) {
  if (!journeys || journeys.length === 0) {
    return null;
  }

  return (
    <div className="departure-board" id="departure-board-section">
      <div className="board-header">
        <div>
          <span className="section-label">Screen 2 — Departure Board</span>
          <h2 className="section-headline">Available Connections</h2>
        </div>
        {isSingleRouteOnly && (
          <span className="config-tag" style={{ color: '#FCD34D' }}>
            Note: Single optimal connection in sample network
          </span>
        )}
      </div>

      <div className="flap-card-grid">
        {journeys.map(j => {
          const isSelected = selectedJourney && selectedJourney.id === j.id;

          return (
            <div
              key={j.id}
              className={`journey-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectJourney(j)}
              role="button"
              tabIndex={0}
              aria-label={`Journey ${j.tags.join(' ')}: ${j.totalTimeMinutes} minutes, ₹${j.fareBreakdown.unifiedPrice}`}
            >
              <div className="card-top-row">
                <div className="badge-group">
                  {j.tags.map(t => (
                    <span
                      key={t}
                      className={`objective-badge ${t.toLowerCase().includes('fast') ? 'fastest' : t.toLowerCase().includes('cheap') ? 'cheapest' : 'balanced'}`}
                    >
                      {t}
                    </span>
                  ))}
                  {j.isThreeModeTrip && (
                    <span className="three-mode-tag">
                      ★ 3-Network Journey
                    </span>
                  )}
                </div>
                {isSelected && (
                  <span style={{ color: '#38BDF8', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 700 }}>
                    <CheckCircle2 size={16} /> Selected
                  </span>
                )}
              </div>

              {/* Metric Row with Departure Board Typography */}
              <div className="metric-row">
                <div>
                  <span className="time-val">{j.totalTimeMinutes}</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>min</span>
                </div>
                <div>
                  <span className="fare-val">₹{j.fareBreakdown.unifiedPrice.toFixed(2)}</span>
                  <span className="fare-est">(est.)</span>
                </div>
              </div>

              {/* Mini Metro Strip Preview */}
              <div className="mini-strip">
                {j.legs.map((leg, idx) => (
                  <React.Fragment key={idx}>
                    {leg.type === 'ride' ? (
                      <div className="mini-leg-segment">
                        {leg.mode === 'metro' ? (
                          <Train size={14} color="var(--line-metro)" />
                        ) : (
                          <Bus size={14} color={leg.mode === 'brts' ? 'var(--line-brts)' : 'var(--line-amts)'} />
                        )}
                        <span className={`mini-line-bar ${leg.mode}`} />
                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                          {leg.mode}
                        </span>
                      </div>
                    ) : (
                      <div className="mini-leg-segment" style={{ color: 'var(--walk-connector)' }}>
                        <Footprints size={12} />
                        <span style={{ fontSize: '0.7rem' }}>walk</span>
                      </div>
                    )}
                    {idx < j.legs.length - 1 && <span style={{ opacity: 0.4 }}>•</span>}
                  </React.Fragment>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {j.transfersCount} {j.transfersCount === 1 ? 'transfer' : 'transfers'}
                </span>
              </div>

              <div className="card-reason">
                "{j.reason}"
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
