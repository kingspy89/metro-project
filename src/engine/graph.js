/**
 * YatraOne Multimodal Graph & State Search Router
 * Constructs a State Graph where labels track (stop_id, current_mode, transfers_used)
 * Supports Multi-Objective Dijkstra: Fastest, Cheapest, Balanced
 */

import stopsData from '../data/stops.json' with { type: 'json' };
import connectionsData from '../data/connections.json' with { type: 'json' };
import transfersData from '../data/transfers.json' with { type: 'json' };
import configData from '../data/config.json' with { type: 'json' };
import linesData from '../data/lines.json' with { type: 'json' };
import { calculateUnifiedFare } from './fare.js';

// Index lookups
export const stopsById = new Map(stopsData.map(s => [s.stop_id, s]));
export const linesById = new Map(linesData.map(l => [l.line_id, l]));

/**
 * Builds adjacency list for multimodal transitions
 */
export function buildTransitGraph() {
  const adjacency = new Map();

  function addEdge(fromState, toState, edgeDetails) {
    if (!adjacency.has(fromState)) {
      adjacency.set(fromState, []);
    }
    adjacency.get(fromState).push({ toState, ...edgeDetails });
  }

  // 1. Ride edges within same mode
  // Transition: (from_stop, mode) -> (to_stop, mode)
  for (const conn of connectionsData) {
    const fromState = `${conn.from_stop_id}::${conn.transport_mode}`;
    const toState = `${conn.to_stop_id}::${conn.transport_mode}`;
    addEdge(fromState, toState, {
      type: 'ride',
      fromStop: conn.from_stop_id,
      toStop: conn.to_stop_id,
      mode: conn.transport_mode,
      lineId: conn.line_id,
      duration: Number(conn.duration_minutes),
      fare: Number(conn.fare),
      distanceKm: Number(conn.distance_km || 1.5)
    });
  }

  // 2. Transfer / walking edges between different stops or modes
  for (const tr of transfersData) {
    const fromStop = stopsById.get(tr.from_stop_id);
    const toStop = stopsById.get(tr.to_stop_id);
    if (!fromStop || !toStop) continue;

    const fromState = `${tr.from_stop_id}::${fromStop.transport_mode}`;
    const toState = `${tr.to_stop_id}::${toStop.transport_mode}`;
    const walkDuration = Number(tr.walking_time_minutes) || Math.round(tr.walking_distance_m / configData.walking_speed_m_per_min);

    addEdge(fromState, toState, {
      type: 'transfer',
      fromStop: tr.from_stop_id,
      toStop: tr.to_stop_id,
      fromMode: fromStop.transport_mode,
      toMode: toStop.transport_mode,
      walkingDistanceM: Number(tr.walking_distance_m),
      duration: walkDuration,
      fare: 0,
      distanceKm: tr.walking_distance_m / 1000
    });
  }

  // 3. Intra-stop transfer if a stop is served by multiple modes or connections
  const modesPerStop = new Map();
  for (const conn of connectionsData) {
    if (!modesPerStop.has(conn.from_stop_id)) modesPerStop.set(conn.from_stop_id, new Set());
    modesPerStop.get(conn.from_stop_id).add(conn.transport_mode);
    if (!modesPerStop.has(conn.to_stop_id)) modesPerStop.set(conn.to_stop_id, new Set());
    modesPerStop.get(conn.to_stop_id).add(conn.transport_mode);
  }
  for (const stop of stopsData) {
    if (!modesPerStop.has(stop.stop_id)) modesPerStop.set(stop.stop_id, new Set());
    modesPerStop.get(stop.stop_id).add(stop.transport_mode);
  }

  for (const [stopId, modes] of modesPerStop.entries()) {
    const modeArr = Array.from(modes);
    for (let i = 0; i < modeArr.length; i++) {
      for (let j = 0; j < modeArr.length; j++) {
        if (i !== j) {
          const fromState = `${stopId}::${modeArr[i]}`;
          const toState = `${stopId}::${modeArr[j]}`;
          addEdge(fromState, toState, {
            type: 'transfer',
            fromStop: stopId,
            toStop: stopId,
            fromMode: modeArr[i],
            toMode: modeArr[j],
            walkingDistanceM: 80,
            duration: 2,
            fare: 0,
            distanceKm: 0.08
          });
        }
      }
    }
  }

  return adjacency;
}

const graphAdjacency = buildTransitGraph();

/**
 * Finds routes using State-Graph Dijkstra for a given objective.
 * @param {string} originStopId 
 * @param {string} destinationStopId 
 * @param {'fastest' | 'cheapest' | 'balanced'} objective 
 * @returns {object|null} Candidate itinerary
 */
export function findPathByObjective(originStopId, destinationStopId, objective = 'balanced') {
  if (originStopId === destinationStopId) {
    return null;
  }

  const originStop = stopsById.get(originStopId);
  const destStop = stopsById.get(destinationStopId);
  if (!originStop || !destStop) return null;

  // Possible starting states at origin stop
  // For origin, the passenger can board whatever mode serves this stop
  const possibleStartModes = [originStop.transport_mode];
  // Also check if any connection leaves this stop with another mode
  for (const conn of connectionsData) {
    if (conn.from_stop_id === originStopId && !possibleStartModes.includes(conn.transport_mode)) {
      possibleStartModes.push(conn.transport_mode);
    }
  }

  // Label-setting Dijkstra: retain separate labels for each transfer count so
  // a cheap/high-transfer arrival cannot erase a viable low-transfer arrival.
  const queue = [];
  const minCost = new Map();

  for (const startMode of possibleStartModes) {
    const startState = `${originStopId}::${startMode}`;
    const initialWait = configData.assumed_wait_minutes[startMode] || 4;
    const initialRecord = {
      state: startState,
      stopId: originStopId,
      currentMode: startMode,
      cost: objective === 'fastest' ? initialWait
        : objective === 'cheapest' ? initialWait * 0.001
          : (0.4 * initialWait / 60),
      totalTime: initialWait,
      inVehicleTime: 0,
      walkingTime: 0,
      waitWaitTime: initialWait,
      totalFare: 0,
      totalDistanceKm: 0,
      walkingDistanceM: 0,
      transfers: 0,
      path: []
    };
    queue.push(initialRecord);
    minCost.set(`${startState}::0`, initialRecord.cost);
  }

  let bestDestRecord = null;

  while (queue.length > 0) {
    // Pick lowest cost
    queue.sort((a, b) => a.cost - b.cost);
    const curr = queue.shift();

    const [currStopId] = curr.state.split('::');
    const currLabel = `${curr.state}::${curr.transfers}`;

    if (curr.cost > (minCost.get(currLabel) ?? Infinity)) continue;

    if (currStopId === destinationStopId) {
      if (!bestDestRecord || curr.cost < bestDestRecord.cost) {
        bestDestRecord = curr;
        break; // First destination reached with lowest cost
      }
    }

    if (curr.transfers > configData.max_transfers) {
      continue;
    }

    const neighbors = graphAdjacency.get(curr.state) || [];
    for (const edge of neighbors) {
      const nextStopId = edge.toStop;
      const nextMode = edge.mode || edge.toMode;
      const nextState = edge.toState;

      const isTransfer = edge.type === 'transfer' || (curr.currentMode !== nextMode);
      const newTransfers = curr.transfers + (isTransfer ? 1 : 0);
      if (newTransfers > configData.max_transfers) continue;

      const transferPenalty = isTransfer ? configData.transfer_penalty_minutes : 0;
      const boardWait = isTransfer ? (configData.assumed_wait_minutes[nextMode] || 4) : 0;

      const legInVehicle = edge.type === 'ride' ? edge.duration : 0;
      const legWalkTime = edge.type === 'transfer' ? edge.duration : 0;
      const legWalkDist = edge.type === 'transfer' ? (edge.walkingDistanceM || 0) : 0;
      const legFare = edge.fare || 0;
      const legDistanceKm = edge.distanceKm || 0;

      const newTotalTime = curr.totalTime + edge.duration + transferPenalty + boardWait;
      const newInVehicle = curr.inVehicleTime + legInVehicle;
      const newWalkingTime = curr.walkingTime + legWalkTime;
      const newWaitTime = curr.waitWaitTime + boardWait;
      const newFare = curr.totalFare + legFare;
      const newDistKm = curr.totalDistanceKm + legDistanceKm;
      const newWalkDistM = curr.walkingDistanceM + legWalkDist;

      // Additive objective costs keep Dijkstra's ordering valid. Balanced uses
      // normalized time, estimated fare, transfers, and walking distance.
      const elapsedDelta = edge.duration + transferPenalty + boardWait;
      const stepCost = objective === 'fastest'
        ? elapsedDelta
        : objective === 'cheapest'
          ? legFare + (elapsedDelta * 0.001)
          : (0.4 * elapsedDelta / 60) + (0.4 * legFare / 35)
            + (isTransfer ? 0.15 : 0) + (0.05 * legWalkDist / 500);
      const nextCost = curr.cost + stepCost;
      const nextLabel = `${nextState}::${newTransfers}`;

      if (!minCost.has(nextLabel) || nextCost < minCost.get(nextLabel)) {
        minCost.set(nextLabel, nextCost);
        const nextPathItem = {
          ...edge,
          boardWait,
          transferPenalty
        };
        queue.push({
          state: nextState,
          stopId: nextStopId,
          currentMode: nextMode,
          cost: nextCost,
          totalTime: newTotalTime,
          inVehicleTime: newInVehicle,
          walkingTime: newWalkingTime,
          waitWaitTime: newWaitTime,
          totalFare: newFare,
          totalDistanceKm: newDistKm,
          walkingDistanceM: newWalkDistM,
          transfers: newTransfers,
          path: [...curr.path, nextPathItem]
        });
      }
    }
  }

  if (!bestDestRecord) return null;

  return formatItinerary(bestDestRecord, originStop, destStop);
}

/**
 * Transforms raw path record into clean presentation legs with bilingual labels
 */
function formatItinerary(record, originStop, destStop) {
  const legs = [];
  let currentRideLeg = null;

  for (let i = 0; i < record.path.length; i++) {
    const item = record.path[i];

    if (item.type === 'ride') {
      if (currentRideLeg && currentRideLeg.mode === item.mode && currentRideLeg.lineId === item.lineId) {
        // Extend existing ride leg on same line
        currentRideLeg.toStop = item.toStop;
        currentRideLeg.stopCount += 1;
        currentRideLeg.intermediateStops.push(item.fromStop);
        currentRideLeg.durationMinutes += item.duration;
        currentRideLeg.fare += item.fare;
        currentRideLeg.distanceKm += item.distanceKm;
      } else {
        if (currentRideLeg) legs.push(currentRideLeg);
        currentRideLeg = {
          type: 'ride',
          mode: item.mode,
          lineId: item.lineId,
          fromStop: item.fromStop,
          toStop: item.toStop,
          stopCount: 1,
          intermediateStops: [],
          durationMinutes: item.duration,
          fare: item.fare,
          distanceKm: item.distanceKm
        };
      }
    } else if (item.type === 'transfer') {
      if (currentRideLeg) {
        legs.push(currentRideLeg);
        currentRideLeg = null;
      }
      legs.push({
        type: 'transfer',
        fromStop: item.fromStop,
        toStop: item.toStop,
        fromMode: item.fromMode,
        toMode: item.toMode,
        walkingDistanceM: item.walkingDistanceM,
        durationMinutes: item.duration,
        fare: 0,
        isLongWalk: (item.walkingDistanceM || 0) >= configData.long_walk_threshold_m
      });
    }
  }

  if (currentRideLeg) {
    legs.push(currentRideLeg);
  }

  // Calculate operator fares
  const operatorFares = legs
    .filter(l => l.type === 'ride')
    .map(l => ({ operator: l.mode, fare: l.fare }));

  const fareBreakdown = calculateUnifiedFare(operatorFares, configData.unified_discount);

  // Collect distinct modes
  const modesUsed = [...new Set(legs.filter(l => l.type === 'ride').map(l => l.mode))];

  return {
    originStop,
    destStop,
    totalTimeMinutes: Math.round(record.totalTime),
    inVehicleMinutes: Math.round(record.inVehicleTime),
    walkingMinutes: Math.round(record.walkingTime),
    waitMinutes: Math.round(record.waitWaitTime),
    walkingDistanceM: Math.round(record.walkingDistanceM),
    totalDistanceKm: Number(record.totalDistanceKm.toFixed(1)),
    transfersCount: record.transfers,
    objectiveScore: record.cost,
    balancedScore: (0.4 * record.totalTime / 60)
      + (0.4 * fareBreakdown.totalStandalone / 35)
      + (0.15 * record.transfers)
      + (0.05 * record.walkingDistanceM / 500),
    modesUsed,
    isThreeModeTrip: modesUsed.includes('metro') && modesUsed.includes('brts') && modesUsed.includes('amts'),
    legs,
    fareBreakdown
  };
}

/**
 * Generates ranked candidate journeys comparing fastest, cheapest, balanced.
 * De-duplicates identical itineraries according to PRD FR-05.
 */
export function generateCandidateJourneys(originStopId, destStopId) {
  if (originStopId === destStopId) {
    return {
      error: "Origin and destination cannot be identical. Please pick two different stops.",
      journeys: []
    };
  }

  const results = [];
  const seenKey = new Set();

  const objectives = [
    { key: 'fastest', label: 'FASTEST', reason: 'Minimum travel time and high-speed transit' },
    { key: 'balanced', label: 'BALANCED', reason: 'Optimal trade-off of time, walking, and cost' },
    { key: 'cheapest', label: 'CHEAPEST', reason: 'Lowest overall passenger fare' }
  ];

  for (const obj of objectives) {
    const path = findPathByObjective(originStopId, destStopId, obj.key);
    if (!path) continue;

    // Signature key to check if itinerary is identical
    const signature = path.legs.map(l => `${l.type}:${l.fromStop}->${l.toStop}`).join('|');

    if (seenKey.has(signature)) {
      // Find existing journey and append tag
      const existing = results.find(r => r.signature === signature);
      if (existing && !existing.tags.includes(obj.label)) {
        existing.tags.push(obj.label);
        existing.objectiveScores[obj.key] = path.objectiveScore;
      }
    } else {
      seenKey.add(signature);
      results.push({
        id: `journey-${results.length + 1}`,
        signature,
        primaryObjective: obj.key,
        tags: [obj.label],
        objectiveScores: { [obj.key]: path.objectiveScore },
        reason: obj.reason,
        ...path
      });
    }
  }

  return {
    error: results.length === 0 ? "We couldn't find a connection in the sample network. Try another pair like Thaltej ➔ Kankaria Lake." : null,
    journeys: results,
    isSingleRouteOnly: results.length === 1
  };
}
