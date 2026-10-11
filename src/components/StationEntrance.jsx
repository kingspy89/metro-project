import React from 'react';
import stopsData from '../data/stops.json' with { type: 'json' };
import locationsData from '../data/locations.json' with { type: 'json' };
import { ArrowUpDown, Search, Sparkles, Navigation } from 'lucide-react';
import { translate } from '../i18n.js';

export default function StationEntrance({
  originStopId,
  destStopId,
  onChangeOrigin,
  onChangeDest,
  onSwap,
  preference,
  onChangePreference,
  onSearch,
  onPickPopular,
  lang = 'en'
}) {
  const t = text => translate(text, lang);
  const popularTrips = [
    {
      label: '★ Seeded 3-Mode Demo (Thaltej ➔ Kankaria Lake)',
      origin: 'M_EW_02',
      dest: 'A_KANKARIA',
      featured: true
    },
    {
      label: 'Motera Stadium ➔ GIFT City (Phase 2 Metro)',
      origin: 'M_MOTERA',
      dest: 'M_GIFT_02',
      featured: true
    },
    {
      label: 'Bopal ➔ LD Engineering College',
      origin: 'B_BOPAL',
      dest: 'A_LDENGG',
      featured: false
    },
    {
      label: 'Thaltej Gam ➔ Mahatma Mandir (Gandhinagar)',
      origin: 'M_EW_01',
      dest: 'M_GN_17',
      featured: false
    },
    {
      label: 'APMC ➔ Kalupur Railway Station',
      origin: 'M_NS_01',
      dest: 'M_KALUPUR',
      featured: false
    }
  ];

  return (
    <div className="station-entrance" id="station-entrance-section">
      <div className="search-title-row">
        <span className="section-label">{t('Screen 1 — Station Entrance')}</span>
        <h2 className="section-headline">{t('Plan Your Multimodal Trip')}</h2>
      </div>

      {/* Stacked Route Strip Selector */}
      <div className="route-selector-strip">
        <div className="selector-box">
          <label className="selector-tag" htmlFor="origin-select">
            <span className="node-pin origin" /> {t('Origin Station / Hub')}
          </label>
          <select
            id="origin-select"
            value={originStopId}
            onChange={e => onChangeOrigin(e.target.value)}
            className="select-input"
          >
            {stopsData.map(s => (
              <option key={s.stop_id} value={s.stop_id}>
                {(lang === 'gu' ? (s.stop_name_gu || s.stop_name) : s.stop_name)} ({s.transport_mode.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        <button
          className="swap-btn"
          onClick={onSwap}
          title={t('Swap origin and destination')}
          aria-label={t('Swap origin and destination')}
        >
          <ArrowUpDown size={18} />
        </button>

        <div className="selector-box">
          <label className="selector-tag" htmlFor="dest-select">
            <span className="node-pin dest" /> {t('Destination Station / Hub')}
          </label>
          <select
            id="dest-select"
            value={destStopId}
            onChange={e => onChangeDest(e.target.value)}
            className="select-input"
          >
            {stopsData.map(s => (
              <option key={s.stop_id} value={s.stop_id}>
                {(lang === 'gu' ? (s.stop_name_gu || s.stop_name) : s.stop_name)} ({s.transport_mode.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Preference Chips & Search Action */}
      <div className="search-controls-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {t('Routing Priority:')}
          </span>
          <div className="preference-chips">
            <button
              className={`chip-btn ${preference === 'fastest' ? 'active' : ''}`}
              onClick={() => onChangePreference('fastest')}
            >
              {t('Fastest')}
            </button>
            <button
              className={`chip-btn ${preference === 'balanced' ? 'active' : ''}`}
              onClick={() => onChangePreference('balanced')}
            >
              {t('Balanced')}
            </button>
            <button
              className={`chip-btn ${preference === 'cheapest' ? 'active' : ''}`}
              onClick={() => onChangePreference('cheapest')}
            >
              {t('Cheapest')}
            </button>
          </div>
        </div>

        <button
          className="primary-search-btn"
          onClick={onSearch}
          id="btn-find-journey"
        >
          <Search size={18} /> {t('Find My Journey')}
        </button>
      </div>

      {/* Popular Quick-Pick Trip Pills */}
      <div className="popular-trips-section">
        <span className="popular-label">{t('Popular routes:')}</span>
        {popularTrips.map((p, idx) => (
          <button
            key={idx}
            className={`popular-pill ${p.featured ? 'featured' : ''}`}
            onClick={() => onPickPopular(p.origin, p.dest)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
