import React, { lazy, Suspense, useRef, useState, useEffect } from 'react';
import allStopIds from './data/all_stop_ids.json' with { type: 'json' };
import { searchRateLimiter } from './security/rateLimiter.js';
import { validateStopId } from './security/sanitizer.js';
import { findJourneysInWorker } from './engine/routePlannerClient.js';

const DepartureBoard = lazy(() => import('./components/DepartureBoard.jsx'));
const StationEntrance = lazy(() => import('./components/StationEntrance.jsx'));
const MetroMap = lazy(() => import('./components/MetroMap.jsx'));
const JourneyTimeline = lazy(() => import('./components/JourneyTimeline.jsx'));
const UnifiedTicket = lazy(() => import('./components/UnifiedTicket.jsx'));
const ControlRoom = lazy(() => import('./components/ControlRoom.jsx'));
const StationDetailModal = lazy(() => import('./components/StationDetailModal.jsx'));
const DataTransparencyModal = lazy(() => import('./components/DataTransparencyModal.jsx'));
import SecurityStatusBar from './components/SecurityStatusBar.jsx';
const TripAssistant = lazy(() => import('./components/TripAssistant.jsx'));
import { translate } from './i18n.js';

const validStopIds = new Set(allStopIds);

import { 
  Sun, 
  Moon, 
  Languages, 
  Info, 
  Sliders, 
  AlertCircle
} from 'lucide-react';

export default function App() {
  // Theme & Language State
  const [theme, setTheme] = useState('dark');
  const [activeLang, setActiveLang] = useState('en');
  const t = text => translate(text, activeLang);

  // Route Planning State (Default seeded demo: Thaltej -> Kankaria Lake)
  const [originStopId, setOriginStopId] = useState('M_EW_02');
  const [destStopId, setDestStopId] = useState('AMC_1334');
  const [preference, setPreference] = useState('balanced');

  // Search Results State
  const [journeys, setJourneys] = useState([]);
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [isSingleRouteOnly, setIsSingleRouteOnly] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchSequence = useRef(0);
  const initialSearchStarted = useRef(false);

  // Modals & Panels State
  const [activeStationModal, setActiveStationModal] = useState(null);
  const [showTransparencyModal, setShowTransparencyModal] = useState(false);
  const [showControlRoom, setShowControlRoom] = useState(false);

  // Rate Limiting & Feedback State
  const [rateLimitNotice, setRateLimitNotice] = useState(null);

  // Load the route engine when the first plan is requested.
  useEffect(() => {
    if (initialSearchStarted.current) return;
    initialSearchStarted.current = true;
    handleExecuteSearch('M_EW_02', 'AMC_1334', 'balanced');
  }, []);

  // Update HTML data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Execute Search with Rate Limiting and Validation
  const handleExecuteSearch = async (origId, dstId, pref) => {
    const sequence = ++searchSequence.current;
    setSearchError(null);
    setRateLimitNotice(null);
    setIsSearching(true);
    const clearStaleJourney = () => {
      setJourneys([]);
      setSelectedJourney(null);
      setIsSingleRouteOnly(false);
    };

    // Rate Limiter Check (Defense against spam/DoS)
    const rateCheck = searchRateLimiter.isAllowed();
    if (!rateCheck.allowed) {
      clearStaleJourney();
      setRateLimitNotice(`Rate Limit: Too many searches. Please wait ${rateCheck.retryAfterMs / 1000}s.`);
      setIsSearching(false);
      return;
    }

    // Input Validation
    if (!validateStopId(origId, validStopIds) || !validateStopId(dstId, validStopIds)) {
      clearStaleJourney();
      setSearchError("Invalid station identifier selected.");
      setIsSearching(false);
      return;
    }

    if (origId === dstId) {
      setSearchError("Origin and destination stations cannot be the same. Please choose two distinct locations.");
      clearStaleJourney();
      setIsSearching(false);
      return;
    }

    // Query engine
    let searchResult;
    try {
      searchResult = await findJourneysInWorker(origId, dstId);
    } catch (error) {
      if (sequence === searchSequence.current) setSearchError('The route planner could not load. Please try again.');
      console.error('[YatraOne route planner]', error);
      return;
    } finally {
      if (sequence === searchSequence.current) setIsSearching(false);
    }

    if (sequence !== searchSequence.current) return;

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
      sorted.sort((a, b) => a.fareBreakdown.estimatedTotal - b.fareBreakdown.estimatedTotal
        || Number(b.fareBreakdown.isComplete) - Number(a.fareBreakdown.isComplete)
        || a.totalTimeMinutes - b.totalTimeMinutes);
    } else {
      // Rank by the route planner's additive balanced score; mode count alone
      // should not make an itinerary look better.
      sorted.sort((a, b) => a.balancedScore - b.balancedScore);
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
    <div className="app-container" lang={activeLang === 'gu' ? 'gu' : 'en'}>
      {/* Cinematic transit landing hero */}
      <section className="landing-hero" id="home">
      <video
        className="hero-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/images/gemini-generated-hero-poster.jpg"
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src="/videos/gemini_generated_video_429b205b.mp4" type="video/mp4" />
      </video>
      <header className="station-header hero-nav">
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
              {t('One journey. Three networks. Drawn like a metro map.')}
            </div>
          </div>
        </div>

        <nav className="landing-nav" aria-label={activeLang === 'gu' ? 'મુખ્ય નેવિગેશન' : 'Main navigation'}>
          <a href="#home">{activeLang === 'gu' ? 'હોમ' : 'Home'}</a>
          <a href="#station-entrance-section">{activeLang === 'gu' ? 'મુસાફરી' : 'Plan trip'}</a>
          <a href="#hero-map-screen">{activeLang === 'gu' ? 'નેટવર્ક' : 'Network'}</a>
          <a href="#app-footer">{activeLang === 'gu' ? 'વિગતો' : 'About'}</a>
        </nav>

        <div className="header-actions">
          {/* Tunnel Offline Indicator per PRD Section 6.3 */}
          <div className="offline-pill" title="Works completely offline without network calls">
            <span className="offline-pulse" />
            <span>{t('Planning underground — no internet needed')}</span>
          </div>

          {/* Operator Control Room Toggle */}
          <button
            className={`icon-btn ${showControlRoom ? 'active' : ''}`}
            onClick={() => setShowControlRoom(!showControlRoom)}
            title="Toggle Operator Control Room"
          >
            <Sliders size={15} />
            <span>{t('Control Room')}</span>
          </button>

          {/* Data Transparency Sheet Button */}
          <button
            className="icon-btn"
            onClick={() => setShowTransparencyModal(true)}
            title="About this data & transparency"
          >
            <Info size={15} />
            <span>{t('About Data')}</span>
          </button>

          {/* Language Toggle */}
          <button
            className="icon-btn"
            onClick={() => setActiveLang(activeLang === 'en' ? 'gu' : 'en')}
            title="Switch Language (English / Gujarati / Bilingual)"
            aria-label={t('Switch language')}
          >
            <Languages size={15} />
            <span>{activeLang === 'gu' ? 'ગુજરાતી' : 'English'}</span>
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

      <div className="landing-copy">
        <div className="landing-eyebrow"><span className="landing-eyebrow-dot" />{t('Ahmedabad, connected')}</div>
        <h1>{t('Move smarter')}<br /><span>{t('across Ahmedabad.')}</span></h1>
        <p>{t('Metro, Janmarg BRTS and AMTS—one clear plan for the way across your city.')}</p>
        <div className="landing-actions">
          <a className="landing-cta" href="#station-entrance-section">{t('Plan your journey')}<span aria-hidden="true">↗</span></a>
          <a className="landing-secondary" href="#hero-map-screen">{t('Explore the network')}<span aria-hidden="true">↓</span></a>
        </div>
        <div className="landing-networks" aria-label="Transit networks">
          <span><i className="logo-dot metro" /> Metro</span>
          <span><i className="logo-dot brts" /> Janmarg BRTS</span>
          <span><i className="logo-dot amts" /> AMTS</span>
          <b>{t('One connected journey')}</b>
        </div>
        {selectedJourney && <div className="landing-trip-preview">
          <span className="preview-route-mark"><i /><i /><i /></span>
          <span className="preview-stops">{activeLang === 'gu' ? (selectedJourney.originStop.stop_name_gu || selectedJourney.originStop.stop_name) : selectedJourney.originStop.stop_name}<b>→</b>{activeLang === 'gu' ? (selectedJourney.destStop.stop_name_gu || selectedJourney.destStop.stop_name) : selectedJourney.destStop.stop_name}</span>
          <span className="preview-divider" />
          <span>{selectedJourney.totalTimeMinutes} {activeLang === 'gu' ? 'મિનિટ અંદાજિત' : 'min estimated'}</span>
          <span className="preview-sample">{activeLang === 'gu' ? 'નમૂનો' : 'SAMPLE'}</span>
        </div>}
      </div>
      <a className="landing-scroll-cue" href="#station-entrance-section" aria-label={t('Plan your journey')}><span /></a>
      </section>

      {/* Security Status Bar (CSP, Rate Limiter, Zero Leaks) */}
      <SecurityStatusBar />

      {/* Screen 1: Station Entrance */}
      <Suspense fallback={<div className="search-loading" role="status">{t('Loading station search…')}</div>}>
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
        isSearching={isSearching}
        onPickPopular={handlePickPopular}
        lang={activeLang}
      />
      </Suspense>

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
        <Suspense fallback={null}>
          <ControlRoom journey={selectedJourney} onClose={() => setShowControlRoom(false)} />
        </Suspense>
      )}

      {/* Screen 2: Departure Board Results */}
      {journeys.length > 0 && (
        <Suspense fallback={<div className="search-loading" role="status">{t('Loading trip options…')}</div>}>
          <DepartureBoard
            journeys={journeys}
            selectedJourney={selectedJourney}
            onSelectJourney={setSelectedJourney}
            preference={preference}
            isSingleRouteOnly={isSingleRouteOnly}
            lang={activeLang}
          />
        </Suspense>
      )}

      {/* Screen 3: Journey Map "Your Line" (Hero Screen) */}
      {selectedJourney && (
        <div className="hero-map-section" id="hero-map-screen">
          <div className="hero-title-bar">
            <div>
              <span className="section-label">{t('Screen 3 — Hero Journey Map')}</span>
              <h2 className="section-headline">
                {activeLang === 'gu' ? (selectedJourney.originStop.stop_name_gu || selectedJourney.originStop.stop_name) : selectedJourney.originStop.stop_name} ➔ {activeLang === 'gu' ? (selectedJourney.destStop.stop_name_gu || selectedJourney.destStop.stop_name) : selectedJourney.destStop.stop_name}
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="config-tag" style={{ color: '#38BDF8', fontWeight: 700 }}>
                {selectedJourney.modesUsed.map(m => m.toUpperCase()).join(' + ')}
              </span>
              <span className="config-tag">
                {selectedJourney.totalTimeMinutes} {activeLang === 'gu' ? 'મિનિટ' : 'min'} · {selectedJourney.fareBreakdown.isComplete
                  ? `${activeLang === "gu" ? "નમૂનો" : "sample"} ₹${selectedJourney.fareBreakdown.unifiedPrice.toFixed(2)}`
                  : selectedJourney.fareBreakdown.estimatedSubtotal > 0 ? `${activeLang === "gu" ? "અંદાજ" : "predicted"} ₹${selectedJourney.fareBreakdown.estimatedTotal.toFixed(2)}`
                    : activeLang === "gu" ? "ભાડું ઉપલબ્ધ નથી" : "fare unavailable"}
              </span>
            </div>
          </div>

          {/* Interactive SVG Metro Map */}
          <Suspense fallback={<div className="map-loading" role="status">{t('Loading the transit map…')}</div>}>
            <MetroMap
              selectedJourney={selectedJourney}
              onSelectStation={station => setActiveStationModal(station)}
              activeLang={activeLang}
            />
          </Suspense>

          {/* Announcement-Style Step-by-Step Timeline */}
          <Suspense fallback={<div className="search-loading">{t('Loading journey details…')}</div>}>
            <JourneyTimeline journey={selectedJourney} lang={activeLang} />
            <TripAssistant journey={selectedJourney} lang={activeLang} />
          </Suspense>
        </div>
      )}

      {/* Screen 4: Unified Ticket Card */}
      {selectedJourney && (
        <Suspense fallback={null}>
          <UnifiedTicket journey={selectedJourney} lang={activeLang} />
        </Suspense>
      )}

      {/* Station Detail Bottom Sheet / Modal */}
      <Suspense fallback={null}>
      {activeStationModal && (
        <StationDetailModal
          station={activeStationModal}
          lang={activeLang}
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
      </Suspense>

      {/* Data Transparency & Privacy Governance Modal */}
      {showTransparencyModal && (
        <Suspense fallback={null}>
          <DataTransparencyModal onClose={() => setShowTransparencyModal(false)} lang={activeLang} />
        </Suspense>
      )}

      {/* App Footer */}
      <footer className="app-footer" id="app-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="offline-pulse" style={{ background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
            <span>{t('Offline-ready · Sample data')}</span>
        </div>

        <div className="footer-links">
          <span
            className="footer-link"
            onClick={() => setShowTransparencyModal(true)}
          >
            {t('Data Transparency')}
          </span>
          <span
            className="footer-link"
            onClick={() => setShowTransparencyModal(true)}
          >
            {t('Privacy & Terms')}
          </span>
          <span>© 2026 YatraOne Transit Initiative</span>
        </div>
      </footer>
    </div>
  );
}

