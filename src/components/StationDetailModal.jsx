import React from 'react';
import { X, Train, Bus, MapPin, Footprints, ExternalLink } from 'lucide-react';
import transfersData from '../data/transfers.json' with { type: 'json' };
import linesData from '../data/lines.json' with { type: 'json' };
import { stopsById } from '../engine/graph.js';

export default function StationDetailModal({ station, onClose, onSetOrigin, onSetDest }) {
  if (!station) return null;

  // Find transfers connected to this station
  const relatedTransfers = transfersData.filter(t => t.from_stop_id === station.stop_id);

  const ModeIcon = station.transport_mode === 'metro' ? Train : Bus;
  const line = linesData.find(item => item.line_id === station.line_id);
  const mapsQuery = encodeURIComponent(`${station.stop_name} ${station.transport_mode === 'metro' ? 'metro station' : 'bus stop'}, Ahmedabad, Gujarat, India`);
  const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className={`step-num-badge ${station.transport_mode}`}>
              <ModeIcon size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700 }}>
                {station.transport_mode === 'metro' ? 'Metro Station' : station.transport_mode === 'brts' ? 'BRTS Stop' : 'AMTS Bus Stand'}
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-bright)' }}>
                {station.stop_name}
              </h3>
              {station.stop_name_gu && (
                <div style={{ fontSize: '0.95rem', color: '#94A3B8', fontWeight: 600 }}>
                  {station.stop_name_gu}
                </div>
              )}
            </div>
          </div>

          <button className="close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 10, border: '1px solid var(--border-subtle)', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Stop information
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-bright)' }}>
            <strong>Corridor:</strong> {line?.line_name || station.transport_mode.toUpperCase()}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Prototype stop ID: {station.stop_id}. Route numbers and live arrivals are not available in this local dataset.
          </div>
          <a href={mapsSearchUrl} target="_blank" rel="noreferrer" className="icon-btn" style={{ justifyContent: 'center', textDecoration: 'none' }}>
            <MapPin size={16} /> Find this {station.transport_mode === 'metro' ? 'station' : 'bus stand'} in Google Maps <ExternalLink size={14} />
          </a>
        </div>

        {/* Instructions */}
        <div style={{ background: 'var(--bg-station)', padding: 14, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Boarding & Alighting Guidance
          </div>
          <div style={{ fontSize: '0.95rem', color: 'var(--text-bright)', marginTop: 4 }}>
            {station.is_interchange ? (
              <span>★ Multimodal Interchange Hub: Key interchange point between networks. Follow colored overhead directional signage.</span>
            ) : (
            <span>Regular transit stop on this prototype corridor. Check Google Maps or the operator for current service details.</span>
            )}
          </div>
        </div>

        {/* Transfers at this station */}
        {relatedTransfers.length > 0 && (
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
              Connecting Transfers from this Stop
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {relatedTransfers.map((tr, idx) => {
                const targetStop = stopsById.get(tr.to_stop_id);
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Footprints size={16} color="var(--walk-connector)" />
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-bright)' }}>
                          Walk to {targetStop?.stop_name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {tr.walking_distance_m} m • ~{tr.walking_time_minutes} min walk
                        </div>
                      </div>
                    </div>
                    <span className="config-tag">{targetStop?.transport_mode.toUpperCase()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick action buttons: Set as Origin / Set as Destination */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            className="icon-btn"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => {
              onSetOrigin(station.stop_id);
              onClose();
            }}
          >
            Set as Origin
          </button>
          <button
            className="icon-btn"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => {
              onSetDest(station.stop_id);
              onClose();
            }}
          >
            Set as Destination
          </button>
        </div>
      </div>
    </div>
  );
}
