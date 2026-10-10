import React, { useState, useEffect } from 'react';
import stopsData from './data/stops.json' with { type: 'json' };
import configData from './data/config.json' with { type: 'json' };
import { generateCandidateJourneys, stopsById } from './engine/graph.js';
import { runStartupValidation } from './engine/validator.js';
import { searchRateLimiter } from './security/rateLimiter.js';
import { sanitizeInput, validateStopId } from './security/sanitizer.js';

import StationEntrance from './components/StationEntrance.jsx';
import DepartureBoard from './components/DepartureBoard.jsx';
import MetroMap from './components/MetroMap.jsx';
import JourneyTimeline from './components/JourneyTimeline.jsx';
import UnifiedTicket from './components/UnifiedTicket.jsx';
import ControlRoom from './components/ControlRoom.jsx';
import StationDetailModal from './components/StationDetailModal.jsx';
import DataTransparencyModal from './components/DataTransparencyModal.jsx';
import SecurityStatusBar from './components/SecurityStatusBar.jsx';

import { 
  Sun, 
  Moon, 
  Languages, 
  Info, 
  Sliders, 
  Radio, 
  AlertCircle, 
  ShieldCheck, 
  Compass, 
  CheckCircle2,
  Train
} from 'lucide-react';

export default function App() {
  // Theme & Language State
  const [theme, setTheme] = useState('dark');
  const [activeLang, setActiveLang] = useState('bilingual'); // 'en', 'gu', 'bilingual'

  // Route Planning State (Default seeded demo: Thaltej -> Kankaria Lake)
  const [originStopId, setOriginStopId] = useState('M_EW_02');
  const [destStopId, setDestStopId] = useState('A_KANKARIA');
  const [preference, setPreference] = useState('balanced');

  // Search Results State
  const [journeys, setJourneys] = useState([]);
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [isSingleRouteOnly, setIsSingleRouteOnly] = useState(false);

  // Modals & Panels State
  const [activeStationModal, setActiveStationModal] = useState(null);
  const [showTransparencyModal, setShowTransparencyModal] = useState(false);
  const [showControlRoom, setShowControlRoom] = useState(false);

  // Rate Limiting & Feedback State
  const [rateLimitNotice, setRateLimitNotice] = useState(null);

  // Startup validation check
  useEffect(() => {
    const valResult = runStartupValidation();
    console.log('[YatraOne Engine Startup]', valResult);
    if (!valResult.valid) {
      console.warn('[YatraOne Engine Startup Issues]', valResult.issues);
    }

    // Run initial search for seeded demo journey
    handleExecuteSearch('M_EW_02', 'A_KANKARIA', 'balanced');
  }, []);

  // Update HTML data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Execute Search with Rate Limiting and Validation
  const handleExecuteSearch = (origId, dstId, pref) => {
    setSearchError(null);
    setRateLimitNotice(null);

    // Rate Limiter Check (Defense against spam/DoS)
    const rateCheck = searchRateLimiter.isAllowed();
    if (!rateCheck.allowed) {
      setRateLimitNotice(`Rate Limit: Too many searches. Please wait ${rateCheck.retryAfterMs / 1000}s.`);
      return;
    }

    // Input Validation
    const allStopIds = new Set(stopsData.map(s => s.stop_id));
    if (!validateStopId(origId, allStopIds) || !validateStopId(dstId, allStopIds)) {
      setSearchError("Invalid station identifier selected.");
      return;
    }

    if (origId === dstId) {
      setSearchError("Origin and destination stations cannot be the same. Please choose two distinct locations.");
      setJourneys([]);
      setSelectedJourney(null);
      return;
    }

    // Query engine
    const searchResult = generateCandidateJourneys(origId, dstId);

    if (searchResult.error) {
      setSearchError(searchResult.error);
      setJourneys([]);
      setSelectedJourney(null);
      return;
    }

    // Re-sort journeys based on preference
    let sorted = [...searchResult.journeys];
    if (pref === 'fastest') {
      sorted.sort((a, b) => a.totalTimeMinutes - b.totalTimeMinutes);
    } else if (pref === 'cheapest') {
      sorted.sort((a, b) => a.fareBreakdown.unifiedPrice - b.fareBreakdown.unifiedPrice);
    } else {
      // Balanced: Prioritize 3-mode or optimal trade-off
      sorted.sort((a, b) => (b.isThreeModeTrip ? 1 : 0) - (a.isThreeModeTrip ? 1 : 0));
    }

    setJourneys(sorted);
    setIsSingleRouteOnly(searchResult.isSingleRouteOnly);
    setSelectedJourney(sorted[0] || null);
  };

  const handleSwap = () => {
    const nextOrigin = destStopId;
    const nextDest = originStopId;
    setOriginStopId(nextOrigin);
    setDestStopId(nextDest);
    handleExecuteSearch(nextOrigin, nextDest, preference);
  };

  const handlePickPopular = (orig, dst) => {
    setOriginStopId(orig);
    setDestStopId(dst);
    handleExecuteSearch(orig, dst, preference);
  };

  const handlePreferenceChange = (newPref) => {
    setPreference(newPref);
    handleExecuteSearch(originStopId, destStopId, newPref);
  };

  return (
    <div className="app-container">
      {/* Top Station Signage Header */}
      <header className="station-header">
        <div className="brand-wrapper">
          <div className="logo-badge" title="Metro + BRTS + AMTS Interconnected">
            <span className="logo-dot metro" />
            <span className="logo-dot brts" />
            <span className="logo-dot amts" />
          </div>
          <div>
            <div className="brand-title">
              YatraOne
              <span className="brand-city">Ahmedabad</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              One journey. Three networks. Drawn like a metro map.
            </div>
          </div>
        </div>

        <div className="header-actions">
          {/* Tunnel Offline Indicator per PRD Section 6.3 */}
          <div className="offline-pill" title="Works completely offline without network calls">
            <span className="offline-pulse" />
            <span>Planning underground — no internet needed</span>
          </div>

          {/* Operator Control Room Toggle */}
          <button
            className={`icon-btn ${showControlRoom ? 'active' : ''}`}
            onClick={() => setShowControlRoom(!showControlRoom)}
            title="Toggle Operator Control Room"
          >
            <Sliders size={15} />
            <span>Control Room</span>
          </button>

          {/* Data Transparency Sheet Button */}
          <button
            className="icon-btn"
            onClick={() => setShowTransparencyModal(true)}
            title="About this data & transparency"
          >
            <Info size={15} />
            <span>About Data</span>
          </button>

          {/* Language Toggle */}
          <button
            className="icon-btn"
            onClick={() => {
              if (activeLang === 'bilingual') setActiveLang('en');
              else if (activeLang === 'en') setActiveLang('gu');
              else setActiveLang('bilingual');
            }}
            title="Switch Language (English / Gujarati / Bilingual)"
          >
            <Languages size={15} />
            <span>{activeLang === 'bilingual' ? 'EN + ગુજ' : activeLang === 'gu' ? 'ગુજરાતી' : 'English'}</span>
          </button>

          {/* Daylight / Station Board Theme Toggle */}
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle Station Board / Daylight Theme"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* Security Status Bar (CSP, Rate Limiter, Zero Leaks) */}
      <SecurityStatusBar />

      {/* Screen 1: Station Entrance */}
      <StationEntrance
        originStopId={originStopId}
        destStopId={destStopId}
        onChangeOrigin={id => {
          setOriginStopId(id);
          handleExecuteSearch(id, destStopId, preference);
        }}
        onChangeDest={id => {
          setDestStopId(id);
          handleExecuteSearch(originStopId, id, preference);
        }}
        onSwap={handleSwap}
        preference={preference}
        onChangePreference={handlePreferenceChange}
        onSearch={() => handleExecuteSearch(originStopId, destStopId, preference)}
        onPickPopular={handlePickPopular}
      />

      {/* Search or Rate Limit Warnings */}
      {rateLimitNotice && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #EF4444', color: '#FCA5A5', padding: 12, borderRadius: 10, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={18} />
          {rateLimitNotice}
        </div>
      )}

      {searchError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #EF4444', color: '#FCA5A5', padding: 14, borderRadius: 10, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={20} />
          <span>{searchError}</span>
        </div>
      )}

      {/* Screen 5: Operator Control Room (when toggled) */}
      {showControlRoom && selectedJourney && (
        <ControlRoom
          journey={selectedJourney}
          onClose={() => setShowControlRoom(false)}
        />
      )}

      {/* Screen 2: Departure Board Results */}
      {journeys.length > 0 && (
        <DepartureBoard
          journeys={journeys}
          selectedJourney={selectedJourney}
          onSelectJourney={setSelectedJourney}
          preference={preference}
          isSingleRouteOnly={isSingleRouteOnly}
        />
      )}

      {/* Screen 3: Journey Map "Your Line" (Hero Screen) */}
      {selectedJourney && (
        <div className="hero-map-section" id="hero-map-screen">
          <div className="hero-title-bar">
            <div>
              <span className="section-label">Screen 3 — Hero Journey Map</span>
              <h2 className="section-headline">
                {selectedJourney.originStop.stop_name} ➔ {selectedJourney.destStop.stop_name}
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="config-tag" style={{ color: '#38BDF8', fontWeight: 700 }}>
                {selectedJourney.modesUsed.map(m => m.toUpperCase()).join(' + ')}
              </span>
              <span className="config-tag">
                {selectedJourney.totalTimeMinutes} min · ₹{selectedJourney.fareBreakdown.unifiedPrice.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Interactive SVG Metro Map */}
          <MetroMap
            selectedJourney={selectedJourney}
            onSelectStation={station => setActiveStationModal(station)}
            activeLang={activeLang}
          />

          {/* Announcement-Style Step-by-Step Timeline */}
          <JourneyTimeline journey={selectedJourney} />
        </div>
      )}

      {/* Screen 4: Unified Ticket Card */}
      {selectedJourney && (
        <UnifiedTicket journey={selectedJourney} />
      )}

      {/* Station Detail Bottom Sheet / Modal */}
      {activeStationModal && (
        <StationDetailModal
          station={activeStationModal}
          onClose={() => setActiveStationModal(null)}
          onSetOrigin={id => {
            setOriginStopId(id);
            handleExecuteSearch(id, destStopId, preference);
          }}
          onSetDest={id => {
            setDestStopId(id);
            handleExecuteSearch(originStopId, id, preference);
          }}
        />
      )}

      {/* Data Transparency & Privacy Governance Modal */}
      {showTransparencyModal && (
        <DataTransparencyModal
          onClose={() => setShowTransparencyModal(false)}
        />
      )}

      {/* App Footer */}
      <footer className="app-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="offline-pulse" style={{ background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
          <span>Offline-ready · Sample data</span>
        </div>

        <div className="footer-links">
          <span
            className="footer-link"
            onClick={() => setShowTransparencyModal(true)}
          >
            Data Transparency
          </span>
          <span
            className="footer-link"
            onClick={() => setShowTransparencyModal(true)}
          >
            Privacy & Terms
          </span>
          <span>© 2026 YatraOne Transit Initiative</span>
        </div>
      </footer>
    </div>
  );
}
