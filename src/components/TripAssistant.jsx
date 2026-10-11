import { useMemo, useState } from 'react'
import { Bot, ExternalLink, Send, Sparkles } from 'lucide-react'
import stopsData from '../data/stops.json' with { type: 'json' }
import { translate } from '../i18n.js'

const stopsById = new Map(stopsData.map(stop => [stop.stop_id, stop]));

function describeJourney(journey) {
  if (!journey) return 'No trip selected.'
  const legs = journey.legs.map(leg => {
    const from = stopsById.get(leg.fromStop)?.stop_name || leg.fromStop
    const to = stopsById.get(leg.toStop)?.stop_name || leg.toStop
    if (leg.type === 'transfer') return `Walk/transfer: ${from} to ${to}, ${leg.durationMinutes || 0} min.`
    const routeName = leg.routeShortName || leg.routeLongName || leg.lineId || 'line'
    const fare = leg.fareKnown ? `${leg.mode === 'metro' ? 'sample fare' : 'feed adult fare'} ₹${Number(leg.fare).toFixed(2)}` : leg.fareEstimated ? `predicted fare ₹${Number(leg.fare).toFixed(2)}` : 'fare unavailable'
    return `Ride ${leg.mode} (${routeName}): ${from} to ${to}, ${leg.durationMinutes || 0} min, ${fare}.`
  })
  const fareText = journey.fareBreakdown.isComplete
    ? `sample fare total ₹${journey.fareBreakdown.unifiedPrice.toFixed(2)}`
    : journey.fareBreakdown.estimatedTotal > 0
      ? `predicted fare total ₹${journey.fareBreakdown.estimatedTotal.toFixed(2)}; distance-based bus estimates are not operator quotes`
      : `known-fare subtotal ₹${journey.fareBreakdown.totalStandalone.toFixed(2)}; some fares unavailable`;
  return `${journey.originStop.stop_name} to ${journey.destStop.stop_name}. Estimated ${journey.totalTimeMinutes} minutes; ${fareText}. Bus routes use a static community schedule and have no live departures. Legs: ${legs.join(' | ')}`
}

export default function TripAssistant({ journey, lang = 'en' }) {
  const t = text => translate(text, lang)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const itinerary = useMemo(() => describeJourney(journey), [journey])

  const ask = async (question) => {
    const text = question.trim()
    if (!text || busy) return
    const next = [...messages, { role: 'user', text }]
    setMessages(next)
    setDraft('')
    setError('')
    setBusy(true)
    try {
      const response = await fetch('/api/trip-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itinerary, history: next.slice(-8).map(({ role, text: messageText }) => ({ role: role === 'assistant' ? 'model' : 'user', text: messageText })) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'The assistant could not respond.')
      setMessages([...next, { role: 'assistant', text: data.answer, sources: data.sources || [] }])
    } catch (requestError) {
      setError(requestError.message || 'Could not reach the assistant.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="trip-assistant" aria-label="AI trip assistant">
      <div className="trip-assistant-heading">
        <span className="trip-assistant-icon"><Sparkles size={18} /></span>
        <div><h3>{t('Ask YatraOne')}</h3><p>{t('Trip guidance grounded in Google Maps')}</p></div>
        <span className="trip-assistant-tag">{t('AI COPILOT')}</span>
      </div>
      <div className="trip-assistant-notice">{t('Prototype routes and fares are estimates. Confirm schedules, bus numbers, and fares with the operator.')}</div>
      {messages.length === 0 && <div className="assistant-prompts">
        <button onClick={() => ask(lang === 'gu' ? 'મારી પસંદ કરેલી મુસાફરી અને ટ્રાન્સફર સમજાવો.' : 'Explain my selected trip and transfers.')}>{t('Explain this trip')}</button>
        <button onClick={() => ask(lang === 'gu' ? 'મારા માર્ગની નજીકના બસ સ્ટોપ Google Mapsના સ્ત્રોત સાથે શોધો.' : 'What bus stops or stands are near my trip? Use Google Maps sources.')}>{t('Nearby bus stops')}</button>
        <button onClick={() => ask(lang === 'gu' ? 'મુસાફરી પહેલાં મારે શું ચકાસવું જોઈએ?' : 'What should I verify before I travel?')}>{t('What should I verify?')}</button>
      </div>}
      {messages.length > 0 && <div className="assistant-conversation" aria-live="polite">
        {messages.map((message, index) => <div className={`assistant-message ${message.role}`} key={`${index}-${message.role}`}>
          {message.role === 'assistant' && <Bot size={15} />}
          <div><p>{message.text}</p>{message.sources?.length > 0 && <div className="assistant-sources"><span>Google Maps</span>{message.sources.map((source, sourceIndex) => <a key={`${source.uri}-${sourceIndex}`} href={source.uri} target="_blank" rel="noreferrer">{source.title}<ExternalLink size={12} /></a>)}</div>}</div>
        </div>)}
        {busy && <div className="assistant-thinking">{t('Checking grounded sources…')}</div>}
      </div>}
      {error && <p className="assistant-error" role="alert">{error}</p>}
      <form className="assistant-form" onSubmit={event => { event.preventDefault(); ask(draft) }}>
        <input value={draft} onChange={event => setDraft(event.target.value)} maxLength={1200} placeholder={t('Ask about this trip or a nearby bus stand…')} aria-label={t('Ask YatraOne')} />
        <button type="submit" disabled={busy || !draft.trim()} aria-label={lang === 'gu' ? 'મોકલો' : 'Send question'}><Send size={16} /></button>
      </form>
    </section>
  )
}
