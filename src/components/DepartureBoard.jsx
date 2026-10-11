import React from 'react';
import { Train, Bus, Footprints, Clock, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { translate } from '../i18n.js';

export default function DepartureBoard({ journeys, selectedJourney, onSelectJourney, preference, isSingleRouteOnly, lang = 'en' }) {
  const t = text => translate(text, lang);
  if (!journeys || journeys.length === 0) {
    return null;
  }

  return (
    <div className="departure-board" id="departure-board-section">
      <div className="board-header">
        <div>
          <span className="section-label">{t('Screen 2 — Departure Board')}</span>
          <h2 className="section-headline">{t('Available Connections')}</h2>
        </div>
        {isSingleRouteOnly && (
          <span className="config-tag" style={{ color: '#FCD34D' }}>
            {t('Note: Single optimal connection in sample network')}
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
                      {translate(t.toLowerCase(), lang)}
                    </span>
                  ))}
                  {j.isThreeModeTrip && (
                    <span className="three-mode-tag">
                      {lang === 'gu' ? '★ 3-નેટવર્ક મુસાફરી' : '★ 3-Network Journey'}
                    </span>
                  )}
                </div>
                {isSelected && (
                  <span style={{ color: '#38BDF8', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 700 }}>
                    <CheckCircle2 size={16} /> {t('Selected')}
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
                  <span className="fare-est">({t('sample')})</span>
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
                        <span style={{ fontSize: '0.7rem' }}>{t('walk')}</span>
                      </div>
                    )}
                    {idx < j.legs.length - 1 && <span style={{ opacity: 0.4 }}>•</span>}
                  </React.Fragment>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {j.transfersCount} {t('transfers')}
                </span>
              </div>

              <div className="card-reason">
                "{translate(j.reason, lang)}"
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
