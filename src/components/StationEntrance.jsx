import React, { useEffect, useMemo, useState } from 'react';
import stopsData from '../data/stops.json' with { type: 'json' };
import { ArrowUpDown, Search } from 'lucide-react';
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
  isSearching = false,
  onPickPopular,
  lang = 'en'
}) {
  const t = text => translate(text, lang);
  const stopLabel = stop => `${lang === 'gu' ? (stop.stop_name_gu || stop.stop_name) : stop.stop_name} · ${stop.transport_mode.toUpperCase()} · ${stop.stop_id}`;
  const stopOptions = useMemo(() => stopsData.map(stop => ({ id: stop.stop_id, label: stopLabel(stop) })), [lang]);
  const optionToId = useMemo(() => new Map(stopOptions.map(option => [option.label, option.id])), [stopOptions]);
  const selectedOrigin = stopsData.find(stop => stop.stop_id === originStopId);
  const selectedDestination = stopsData.find(stop => stop.stop_id === destStopId);
  const [originDraft, setOriginDraft] = useState(selectedOrigin ? stopLabel(selectedOrigin) : '');
  const [destinationDraft, setDestinationDraft] = useState(selectedDestination ? stopLabel(selectedDestination) : '');
  useEffect(() => { setOriginDraft(selectedOrigin ? stopLabel(selectedOrigin) : ''); }, [originStopId, lang]);
  useEffect(() => { setDestinationDraft(selectedDestination ? stopLabel(selectedDestination) : ''); }, [destStopId, lang]);
  const validInputs = optionToId.has(originDraft) && optionToId.has(destinationDraft);
  const popularTrips = [
    {
      label: 'Thaltej Metro to Kankaria Zoo (Metro + bus)',
      origin: 'M_EW_02',
      dest: 'AMC_1334',
      featured: true
    },
    {
      label: 'Motera Stadium ➔ GIFT City (Phase 2 Metro)',
      origin: 'M_MOTERA',
      dest: 'M_GIFT_02',
      featured: true
    },
    {
      label: 'Bopal to Lal Darwaja (AMTS)',
      origin: 'AMC_6369',
      dest: 'AMC_5978',
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
          <input
            list="transit-stop-options"
            type="search"
            id="origin-select"
            value={originDraft}
            placeholder={t('Search 3,000+ stations and bus stops')}
            onChange={e => { setOriginDraft(e.target.value); if (optionToId.has(e.target.value)) onChangeOrigin(optionToId.get(e.target.value)); }}
            className="select-input"
          />
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
          <input
            list="transit-stop-options"
            type="search"
            id="dest-select"
            value={destinationDraft}
            placeholder={t('Search 3,000+ stations and bus stops')}
            onChange={e => { setDestinationDraft(e.target.value); if (optionToId.has(e.target.value)) onChangeDest(optionToId.get(e.target.value)); }}
            className="select-input"
          />
        </div>
      </div>
      <datalist id="transit-stop-options">
        {stopOptions.map(option => <option key={option.id} value={option.label} />)}
      </datalist>

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
          disabled={!validInputs || isSearching}
          id="btn-find-journey"
        >
          <Search size={18} /> {isSearching ? t('Finding routes…') : t('Find My Journey')}
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
