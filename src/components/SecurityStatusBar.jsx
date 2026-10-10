import React from 'react';
import { ShieldCheck, Lock, Activity, EyeOff, Server } from 'lucide-react';
import { searchRateLimiter } from '../security/rateLimiter.js';

export default function SecurityStatusBar() {
  const status = searchRateLimiter.getStatus();

  return (
    <div className="security-status-bar" id="security-status-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ShieldCheck size={16} color="#34D399" />
        <span style={{ fontWeight: 700 }}>Security Hardened:</span>
        <span>CSP Enforced · Local-First (Zero Data Leaks) · XSS Sanitized</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Activity size={14} color="#60A5FA" />
          <span>Rate Limiting: {status.activeCount}/{status.maxLimit} reqs / {status.windowSeconds}s</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <EyeOff size={14} color="#FBBF24" />
          <span>DPDP/GDPR: 100% On-Device</span>
        </div>
      </div>
    </div>
  );
}
