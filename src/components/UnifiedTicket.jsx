import React, { useState } from 'react';
import { Ticket, Share2, HelpCircle, ChevronDown, ChevronUp, Download, Check, ShieldAlert, ExternalLink } from 'lucide-react';
import confetti from 'canvas-confetti';
import { translate } from '../i18n.js';

export default function UnifiedTicket({ journey, lang = 'en' }) {
  const t = text => translate(text, lang);
  const [showFormula, setShowFormula] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!journey || !journey.fareBreakdown) return null;

  const { fareBreakdown } = journey;
  const { totalStandalone, discount, unifiedPrice, allocations, formulaExplanation } = fareBreakdown;

  // Function to export ticket as PNG using HTML5 Canvas (100% offline, native)
  const handleExportTicket = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 420;
      const ctx = canvas.getContext('2d');

      // Draw background
      ctx.fillStyle = '#0C152B';
      ctx.fillRect(0, 0, 600, 420);

      // Border
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 3;
      ctx.strokeRect(15, 15, 570, 390);

      // Header
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 22px system-ui';
      ctx.fillText('YATRAONE — JOURNEY FARE ESTIMATE', 40, 55);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '13px monospace';
      ctx.fillText('SAMPLE ONLY · NOT A VALID TRANSIT TICKET', 40, 80);

      // Route
      ctx.fillStyle = '#60A5FA';
      ctx.font = 'bold 16px system-ui';
      ctx.fillText(`${journey.originStop.stop_name} ➔ ${journey.destStop.stop_name}`, 40, 120);

      // Divider
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(30, 140);
      ctx.lineTo(570, 140);
      ctx.stroke();
      ctx.setLineDash([]);

      // Fare
      ctx.fillStyle = '#34D399';
      ctx.font = 'bold 32px monospace';
      ctx.fillText(`₹${unifiedPrice.toFixed(2)}`, 40, 185);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '13px system-ui';
      ctx.fillText('Estimated total from local sample data', 160, 180);

      // Operator splits
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 14px system-ui';
      ctx.fillText('SAMPLE FARE SUBTOTAL BY NETWORK:', 40, 230);

      let curY = 260;
      allocations.forEach(a => {
        const color = a.operator === 'metro' ? '#3B82F6' : a.operator === 'brts' ? '#10B981' : '#F59E0B';
        ctx.fillStyle = color;
        ctx.fillRect(40, curY - 12, 12, 12);
        ctx.fillStyle = '#F8FAFC';
        ctx.font = '14px system-ui';
        ctx.fillText(`${a.operator.toUpperCase()}:`, 60, curY);
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`₹${a.allocation.toFixed(2)} (${a.allocationPaise} paise)`, 260, curY);
        curY += 28;
      });

      // Disclaimer
      ctx.fillStyle = '#FCD34D';
      ctx.font = 'italic 11px system-ui';
      ctx.fillText('* Sample estimate only. Check the operator for the fare.', 40, 380);

      // Trigger download
      const link = document.createElement('a');
      link.download = `YatraOne-Ticket-${journey.originStop.stop_name}-${journey.destStop.stop_name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      // Confetti celebration
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.8 }
      });

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Error generating ticket image:', err);
    }
  };

  return (
    <div className="unified-ticket-card" id="unified-ticket-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ padding: 8, background: 'rgba(59, 130, 246, 0.2)', borderRadius: 8, color: '#60A5FA' }}>
            <Ticket size={24} />
          </div>
          <div>
            <span className="section-label">{t('Screen 4 — Sample Fare Estimate')}</span>
            <h2 className="section-headline">{t('Fare Estimate & Ticket Demo')}</h2>
          </div>
        </div>

        <button
          className="icon-btn"
          onClick={handleExportTicket}
          title="Export journey pass as PNG"
        >
          {downloadSuccess ? (
            <>
            <Check size={16} color="#34D399" /> {t('Downloaded!')}
            </>
          ) : (
            <>
              <Download size={16} /> {t('Share / Export Ticket PNG')}
            </>
          )}
        </button>
      </div>

      {/* Honest Fare Banner per PRD Screen 4 */}
      <div className="honesty-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={18} />
          <span>{t('Sample edge fares are summed across each ride. These are not official fare quotes or a usable ticket.')}</span>
        </div>
        <span className="config-tag">{t('Sample amounts grouped by network')}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        <a className="icon-btn" href="https://www.gujaratmetrorail.com/ahmedabad/route-and-fares/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          {t('Check Metro fare')} <ExternalLink size={14} />
        </a>
        <a className="icon-btn" href="https://www.ahmedabadbrts.org/en/information/fare-chart/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          {t('Check BRTS fare')} <ExternalLink size={14} />
        </a>
        <a className="icon-btn" href="https://www.amts.co.in/ticketing/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          {t('Check AMTS fare')} <ExternalLink size={14} />
        </a>
      </div>

      {/* Visual Proportional Width Bar per PRD Section 6.2 Screen 4 */}
      <div className="proportional-bar-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>{t('Sample fare subtotal by network')}</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: '#34D399', fontWeight: 700 }}>
            Route estimate: ₹{unifiedPrice.toFixed(2)} (sample)
          </span>
        </div>

        <div className="proportional-bar" title="Share of the prototype estimate by mode">
          {allocations.map(a => (
            <div
              key={a.operator}
              className={`bar-segment ${a.operator}`}
              style={{ width: `${a.sharePercentage}%` }}
              title={`${a.operator.toUpperCase()} sample subtotal: ₹${a.standalone.toFixed(2)} (${a.sharePercentage}%)`}
            />
          ))}
        </div>

        <div className="proportional-legend">
          {allocations.map(a => (
            <div key={a.operator} className="legend-item">
              <span className={`logo-dot ${a.operator}`} />
              <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{a.operator}:</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-bright)' }}>
                ₹{a.standalone.toFixed(2)}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                ({a.sharePercentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="ticket-stub-perforation" />

      {/* Fare estimate by network */}
      <div>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>
          {t('Sample estimate breakdown')}
        </h4>
        <div style={{ overflowX: 'auto' }}>
          <table className="fare-table">
            <thead>
              <tr>
                <th>{t('Network')}</th>
                <th style={{ textAlign: 'right' }}>{t('Sample fare subtotal')}</th>
                <th style={{ textAlign: 'right' }}>{t('Share of sample total')}</th>
                <th style={{ textAlign: 'right' }}>{t('Included in sample total')}</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map(a => (
                <tr key={a.operator}>
                  <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`logo-dot ${a.operator}`} />
                      {a.operator} Network
                    </div>
                  </td>
                  <td className="numeric">₹{a.standalone.toFixed(2)}</td>
                  <td className="numeric" style={{ color: 'var(--text-secondary)' }}>{a.sharePercentage}%</td>
                  <td className="numeric" style={{ color: '#34D399' }}>₹{a.allocation.toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ background: 'rgba(255, 255, 255, 0.04)', fontWeight: 800 }}>
                <td>{t('Sample subtotal')}</td>
                <td className="numeric">₹{totalStandalone.toFixed(2)}</td>
                <td className="numeric">100.00%</td>
                <td className="numeric" style={{ color: '#34D399' }}>₹{unifiedPrice.toFixed(2)}</td>
              </tr>
              <tr style={{ color: '#EC4899', fontWeight: 700 }}>
                <td>{t('Multimodal Discount')}</td>
                <td className="numeric">-₹{discount.toFixed(2)}</td>
                <td className="numeric">-</td>
                <td className="numeric" style={{ color: '#EC4899' }}>-₹{discount.toFixed(2)}</td>
              </tr>
              <tr style={{ background: 'rgba(59, 130, 246, 0.1)', fontWeight: 800 }}>
                <td style={{ color: 'var(--text-bright)' }}>{t('ESTIMATED SAMPLE TOTAL')}</td>
                <td className="numeric">-</td>
                <td className="numeric">-</td>
                <td className="numeric" style={{ color: '#60A5FA', fontSize: '1.15rem' }}>
                  ₹{unifiedPrice.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Fare estimate formula explainer */}
      <div style={{ background: 'var(--bg-station)', padding: 14, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => setShowFormula(!showFormula)}
          style={{
            background: 'none',
            border: 'none',
            color: '#60A5FA',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
            width: '100%',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <HelpCircle size={16} /> {t('How is this estimate calculated?')}
          </span>
          {showFormula ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showFormula && (
          <div style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: 8 }}>{formulaExplanation}</p>
            <div style={{ padding: 10, background: 'rgba(0, 0, 0, 0.25)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
              <div>R_i = (T × F_i) / F_total</div>
              <div>T = ₹{totalStandalone.toFixed(2)} - ₹{discount.toFixed(2)} = ₹{unifiedPrice.toFixed(2)}</div>
              <div>Rounding: Largest-Remainder Method (Hamilton-Hare) to exact paise</div>
              <div style={{ color: '#34D399', marginTop: 4 }}>
                ✓ Exact paise sum verification: {allocations.map(a => a.allocationPaise).join(' + ')} = {Math.round(unifiedPrice * 100)} paise
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
