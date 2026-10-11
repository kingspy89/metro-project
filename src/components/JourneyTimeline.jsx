import React from 'react';
import stopsData from '../data/stops.json' with { type: 'json' };
import { Train, Bus, Footprints, AlertTriangle, ArrowRight } from 'lucide-react';
import { translate } from '../i18n.js';

const stopsById = new Map(stopsData.map(stop => [stop.stop_id, stop]));

export default function JourneyTimeline({ journey, lang = 'en' }) {
  if (!journey) return null;
  const t = text => translate(text, lang);

  let stepNumber = 1;

  return (
    <div className="timeline-section" id="journey-timeline-section">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-bright)' }}>
          {t('Announcement Timeline')}
        </h3>
        <span className="config-tag">
          {t('Configured estimate · Offline timetable')}
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
                {leg.isRouteChange ? <Bus size={18} /> : <Footprints size={18} />}
              </div>

              <div className="step-main">
                {leg.isRouteChange && <div className="step-instruction">{t('Change to route')} {leg.routeShortName || leg.mode?.toUpperCase()} {lang === 'gu' ? 'પર' : 'at'} {fromStop?.stop_name}</div>}
                <div className="step-instruction" style={leg.isRouteChange ? { display: 'none' } : undefined}>
                  {lang === 'gu' ? `${fromStop?.stop_name_gu || fromStop?.stop_name} પર ઉતરો. ${leg.walkingDistanceM} મીટર ચાલીને ${toStop?.stop_name_gu || toStop?.stop_name} પહોંચો` : `Alight at ${fromStop?.stop_name}. Walk ${leg.walkingDistanceM} m to ${toStop?.stop_name}`}
                </div>
                <div className="step-meta">
                  <span>~{leg.durationMinutes} {lang === 'gu' ? 'મિનિટ ટ્રાન્સફર' : 'min transfer'}</span>
                  <span className="config-tag">{lang === 'gu' ? 'અંદાજિત અંતર' : 'configured distance'}</span>
                  {leg.isLongWalk && (
                    <span className="mind-gap-alert">
                    <AlertTriangle size={14} /> {lang === 'gu' ? `લાંબું ચાલવાનું છે (${leg.walkingDistanceM} મીટર)` : `Mind the gap: Long walk ahead (${leg.walkingDistanceM} m)`}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {lang === 'gu' ? `પગલું ${currentStep}` : `Step ${currentStep}`}
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
                  {lang === 'gu' ? `${fromStop?.stop_name_gu || fromStop?.stop_name} પરથી ${leg.mode.toUpperCase()} ${leg.routeShortName ? `રૂટ ${leg.routeShortName} ` : ''}માં બેસો અને ${leg.stopCount} સ્ટેશન પછી ${toStop?.stop_name_gu || toStop?.stop_name} ઉતરો` : `Board ${leg.mode.toUpperCase()}${leg.routeShortName ? ` route ${leg.routeShortName}` : leg.routeLongName ? ` (${leg.routeLongName})` : ''} at ${fromStop?.stop_name} — ride ${leg.stopCount} ${leg.stopCount === 1 ? 'stop' : 'stops'} to ${toStop?.stop_name}`}
              </div>
              <div className="step-meta">
                <span>⏱ {leg.durationMinutes} {lang === 'gu' ? 'મિનિટ મુસાફરી' : 'min in-vehicle'}</span>
                <span>•</span>
                <span>📏 {leg.distanceKm?.toFixed(1)} km</span>
                <span>•</span>
                <span>{leg.fareKnown ? `${leg.mode === 'metro' ? (lang === 'gu' ? 'નમૂનાનું ભાડું:' : 'Sample fare:') : (lang === 'gu' ? 'ફીડ ભાડું:' : 'Feed fare:')} ₹${leg.fare.toFixed(2)}` : leg.fareEstimated ? `${t('Predicted fare')}: ₹${leg.fare.toFixed(2)}` : t('Fare not available')}</span>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {lang === 'gu' ? `પગલું ${currentStep}` : `Step ${currentStep}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
