/**
 * YatraOne Startup Validator
 * Implements acceptance checks from PRD Section 10 & 14:
 * 1. Reference integrity (every stop_id exists)
 * 2. Transfer symmetry
 * 3. Seeded Metro-BRTS-AMTS 3-mode connectivity proof
 * 4. Largest-remainder 100-test audit
 */

import transfersData from '../data/transfers.json' with { type: 'json' };
import busMetadata from '../data/gtfs_metadata.json' with { type: 'json' };
import { runLargestRemainderAudit } from './fare.js';
import { connectionsData, generateCandidateJourneys, stopsById } from './graph.js';

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
    if (conn.duration_minutes == null) warnings.push(`Connection ${conn.from_stop_id}->${conn.to_stop_id} missing duration`);
  }

  // 2. Verify Transfer Symmetry
  const transferSet = new Set(transfersData.map(t => `${t.from_stop_id}->${t.to_stop_id}`));
  for (const tr of transfersData) {
    const reverseKey = `${tr.to_stop_id}->${tr.from_stop_id}`;
    if (!transferSet.has(reverseKey)) {
      warnings.push(`Asymmetric transfer found: ${tr.from_stop_id} -> ${tr.to_stop_id} without return edge`);
    }
  }

  // 3. Verify the current default cross-network example remains connected.
  const seededSearch = generateCandidateJourneys('M_EW_02', 'AMC_1334');
  const hasConnectedRoute = seededSearch.journeys.length > 0;
  if (!hasConnectedRoute) issues.push('Default Metro-to-bus example has no connected path.');
  if (busMetadata.directed_edges !== connectionsData.filter(edge => edge.source === 'community_gtfs').length) {
    issues.push('Imported GTFS edge count does not match the bundled graph.');
  }
  const busFareEdges = connectionsData.filter(edge => edge.source === 'community_gtfs');
  const zeroedBusFares = busFareEdges.filter(edge => edge.fare != null && Number(edge.fare) === 0).length;
  if (zeroedBusFares) issues.push(`${zeroedBusFares} community bus edges are incorrectly represented as zero-fare.`);

  // 4. Run Largest-Remainder 100-case Audit
  const auditResult = runLargestRemainderAudit();
  if (!auditResult.passed) {
    issues.push(`Largest-remainder audit failed ${auditResult.errors.length} cases.`);
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    connectedDemoFound: hasConnectedRoute,
    demoRoute: seededSearch.journeys[0] || null,
    gtfs: busMetadata,
    auditResult
  };
}
