/**
 * YatraOne Startup Validator
 * Implements acceptance checks from PRD Section 10 & 14:
 * 1. Reference integrity (every stop_id exists)
 * 2. Transfer symmetry
 * 3. Seeded Metro-BRTS-AMTS 3-mode connectivity proof
 * 4. Largest-remainder 100-test audit
 */

import stopsData from '../data/stops.json' with { type: 'json' };
import connectionsData from '../data/connections.json' with { type: 'json' };
import transfersData from '../data/transfers.json' with { type: 'json' };
import { runLargestRemainderAudit } from './fare.js';
import { generateCandidateJourneys, stopsById } from './graph.js';

export function runStartupValidation() {
  const issues = [];
  const warnings = [];

  // 1. Verify Stop References in Connections
  for (const conn of connectionsData) {
    if (!stopsById.has(conn.from_stop_id)) {
      issues.push(`Connection references invalid from_stop_id: ${conn.from_stop_id}`);
    }
    if (!stopsById.has(conn.to_stop_id)) {
      issues.push(`Connection references invalid to_stop_id: ${conn.to_stop_id}`);
    }
    if (conn.fare == null || conn.duration_minutes == null) {
      warnings.push(`Connection ${conn.from_stop_id}->${conn.to_stop_id} missing fare or duration`);
    }
  }

  // 2. Verify Transfer Symmetry
  const transferSet = new Set(transfersData.map(t => `${t.from_stop_id}->${t.to_stop_id}`));
  for (const tr of transfersData) {
    const reverseKey = `${tr.to_stop_id}->${tr.from_stop_id}`;
    if (!transferSet.has(reverseKey)) {
      warnings.push(`Asymmetric transfer found: ${tr.from_stop_id} -> ${tr.to_stop_id} without return edge`);
    }
  }

  // 3. Verify Seeded 3-Mode Metro-BRTS-AMTS Journey
  // Test Thaltej (M_EW_02) to Kankaria Lake (A_KANKARIA)
  const seededSearch = generateCandidateJourneys('M_EW_02', 'A_KANKARIA');
  const hasThreeModeRoute = seededSearch.journeys.some(j => j.isThreeModeTrip);

  if (!hasThreeModeRoute) {
    issues.push("CRITICAL: Network lacks a connected Metro-BRTS-AMTS three-mode path!");
  }

  // 4. Run Largest-Remainder 100-case Audit
  const auditResult = runLargestRemainderAudit();
  if (!auditResult.passed) {
    issues.push(`Largest-remainder audit failed ${auditResult.errors.length} cases.`);
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    threeModeDemoFound: hasThreeModeRoute,
    demoRoute: seededSearch.journeys.find(j => j.isThreeModeTrip) || seededSearch.journeys[0],
    auditResult
  };
}
