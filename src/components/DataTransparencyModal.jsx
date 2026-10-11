import React from 'react';
import { X, ShieldCheck, Database, Lock, Globe, FileText, Info } from 'lucide-react';
import configData from '../data/config.json' with { type: 'json' };
import busMetadata from '../data/gtfs_metadata.json' with { type: 'json' };
import { translate } from '../i18n.js';

export default function DataTransparencyModal({ onClose, lang = 'en' }) {
  const t = text => translate(text, lang);
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, background: 'rgba(59, 130, 246, 0.2)', borderRadius: 8, color: '#60A5FA' }}>
              <Database size={22} />
            </div>
            <div>
              <span className="section-label">{t('Data Transparency & Governance')}</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-bright)' }}>
                {lang === 'gu' ? 'આ ડેટા અને સુરક્ષા નીતિઓ વિશે' : 'About This Data & Security Policies'}
              </h3>
            </div>
          </div>

          <button className="close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        {/* PRD Data Honesty Disclosure */}
        <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: 14, borderRadius: 10, color: '#FCD34D', fontSize: '0.86rem' }}>
          <strong>{lang === 'gu' ? 'ડેટા સચોટતા નિયમ:' : 'Data Honesty Rule (PRD v2):'}</strong>
          <p style={{ marginTop: 4 }}>
            {lang === 'gu' ? 'આ પ્રોટોટાઇપના સ્ટોપ, ભાડા, સમય અને ટ્રાન્સફર અંતર સત્તાવાર સ્ત્રોતથી ચકાસ્યા ન હોય ત્યાં સુધી માત્ર ઉદાહરણરૂપ ડેટા છે. ભાડા અને આવકના હિસ્સા ગાણિતિક મોડેલ છે, મંજૂર વ્યાવસાયિક કરાર નથી.' : 'Bus routes and scheduled segment times come from a community GTFS compilation, not a live operator feed. Missing bus fares use a labeled distance-based prediction; it is not an operator quote. Metro travel times, sample fares, and coordinate-based transfer walks remain prototype estimates.'}
          </p>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: 14, borderRadius: 10, fontSize: '0.86rem' }}>
          <h4 style={{ margin: '0 0 6px', color: 'var(--text-bright)' }}>{lang === 'gu' ? 'બસ ડેટાનો સ્ત્રોત' : 'Bus data source'}</h4>
          <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)' }}>
            {busMetadata.stops.toLocaleString()} stops · {busMetadata.routes} routes · valid {busMetadata.validity_start.slice(0, 4)}-{busMetadata.validity_start.slice(4, 6)}-{busMetadata.validity_start.slice(6)} through {busMetadata.validity_end.slice(0, 4)}-{busMetadata.validity_end.slice(4, 6)}-{busMetadata.validity_end.slice(6)}. Imported {busMetadata.imported_at}.
          </p>
          <a href={busMetadata.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-orange)' }}>{busMetadata.source_name}</a>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>{busMetadata.attribution}</p>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>{busMetadata.fare_note}</p>
        </div>

        {/* Configuration Assumptions */}
        <div>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-bright)', marginBottom: 8 }}>
            {lang === 'gu' ? 'મુસાફરી આયોજનની ધારણાઓ' : 'Core Planner Assumptions (config.json)'}
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.82rem' }}>
            <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)' }}>Assumed Wait Times:</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                Metro: {configData.assumed_wait_minutes.metro}m · BRTS: {configData.assumed_wait_minutes.brts}m · AMTS: {configData.assumed_wait_minutes.amts}m
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)' }}>Transfer Penalty:</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                +{configData.transfer_penalty_minutes} min penalty per change
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)' }}>Walking Speed:</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {configData.walking_speed_m_per_min} meters per minute (4.2 km/h)
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)' }}>Sample Integration Discount:</div>
              <div style={{ fontWeight: 600, color: '#34D399' }}>
                ₹{configData.unified_discount.toFixed(2)} (disabled; not an operator fare)
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
            Last Dataset Revision: {configData.last_updated} · City: {configData.city}
          </div>
        </div>

        {/* Security, Resilience & Privacy Governance */}
        <div>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-bright)', marginBottom: 8 }}>
            {lang === 'gu' ? 'સુરક્ષા અને ગોપનીયતા' : 'Security & Privacy Compliance (DPDP & GDPR)'}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Lock size={16} color="#34D399" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong>Zero Location Tracking & Local Privacy:</strong> All routing computation is performed client-side inside the browser sandbox. No user coordinates, queries, or trip history are transmitted to any remote servers.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <ShieldCheck size={16} color="#60A5FA" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong>Content Security Policy & Sanitization:</strong> Strict CSP directives enforce resource loading restrictions, preventing XSS and injection vectors. All input parameters undergo validation.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Globe size={16} color="#FBBF24" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong>Offline-First Resilience:</strong> Functions without internet connection in deep underground metro stations and basements via local static datasets.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

