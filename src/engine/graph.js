/**
 * YatraOne Multimodal Graph & State Search Router
 * Constructs a State Graph where labels track (stop_id, current_mode, transfers_used)
 * Supports Multi-Objective Dijkstra: Fastest, Cheapest, Balanced
 */

import stopsData from '../data/stops.json' with { type: 'json' };
import metroConnections from '../data/connections.json' with { type: 'json' };
import gtfsBusStopIds from '../data/gtfs_bus_stop_ids.json' with { type: 'json' };
import gtfsBusStopAreaIndexes from '../data/gtfs_bus_stop_area_indexes.json' with { type: 'json' };
import gtfsBusEdges from '../data/gtfs_bus_edges.json' with { type: 'json' };
import brtsFareData from '../data/gtfs_brts_adult_fares.json' with { type: 'json' };
import transfersData from '../data/transfers.json' with { type: 'json' };
import configData from '../data/config.json' with { type: 'json' };
import linesData from '../data/lines.json' with { type: 'json' };
import { calculateUnifiedFare } from './fare.js';

// Index lookups
export const stopsById = new Map(stopsData.map(s => [s.stop_id, s]));
export const linesById = new Map(linesData.map(l => [l.line_id, l]));
const gtfsBusLines = linesData.filter(line => line.source === 'community_gtfs');
const gtfsBusStopIndex = new Map(gtfsBusStopIds.map((stopId, index) => [stopId, index]));
const getBrtsAdultFare = (fromStopId, toStopId) => {
  const fromIndex = gtfsBusStopIndex.get(fromStopId);
  const toIndex = gtfsBusStopIndex.get(toStopId);
  if (fromIndex == null || toIndex == null) return null;
  const fromArea = gtfsBusStopAreaIndexes[fromIndex];
  const toArea = gtfsBusStopAreaIndexes[toIndex];
  if (fromArea < 0 || toArea < 0) return null;
  return brtsFareData.adult_fares[fromArea]?.[toArea] ?? null;
};
const predictBusFare = (mode, fromStopId, toStopId) => {
  const from = stopsById.get(fromStopId);
  const to = stopsById.get(toStopId);
  if (!from || !to) return null;
  const radians = Math.PI / 180;
  const lat1 = from.latitude * radians;
  const lat2 = to.latitude * radians;
  const dLat = lat2 - lat1;
  const dLon = (to.longitude - from.longitude) * radians;
  const haversine = 2 * 6371 * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2));
  const estimatedRouteKm = haversine * 1.35;
  const ratePerKm = mode === 'brts' ? 1.8 : 1.5;
  return Math.max(5, Math.round(5 + estimatedRouteKm * ratePerKm));
};
const routeLabel = (state, transfers, lineId, mode, boardingStop) => {
  const stopIndex = boardingStop == null ? null : gtfsBusStopIndex.get(boardingStop);
  const fareArea = mode === 'brts' && stopIndex != null ? gtfsBusStopAreaIndexes[stopIndex] : '';
  return `${state}::${transfers}::${lineId || ''}::${fareArea}`;
};
export const connectionsData = [
  ...metroConnections,
  ...gtfsBusEdges.map(([fromIndex, toIndex, lineIndex, durationTenths, distanceHundredths]) => {
    const line = gtfsBusLines[lineIndex];
    return {
      from_stop_id: gtfsBusStopIds[fromIndex],
      to_stop_id: gtfsBusStopIds[toIndex],
      transport_mode: line.mode,
      line_id: line.line_id,
      duration_minutes: durationTenths / 10,
      fare: null,
      fare_known: false,
      distance_km: distanceHundredths / 100,
      route_short_name: line.route_short_name,
      route_long_name: line.route_long_name,
      source: 'community_gtfs'
    };
  })
];

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
      route_short_name: conn.route_short_name || null,
      route_long_name: conn.route_long_name || null,
      duration: Number(conn.duration_minutes),
      fare: conn.fare == null || conn.fare === '' || !Number.isFinite(Number(conn.fare)) ? null : Number(conn.fare),
      fareKnown: conn.fare_known !== false && conn.fare != null && conn.fare !== '' && Number.isFinite(Number(conn.fare)),
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

// Dijkstra's open set. A binary min-heap avoids sorting the whole queue after
// each relaxation, which matters as the bus network grows.
class MinHeap {
  items = [];

  get size() { return this.items.length; }

  push(item) {
    const items = this.items;
    items.push(item);
    let index = items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if ((items[parent].priority ?? items[parent].cost) <= (item.priority ?? item.cost)) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = item;
  }

  pop() {
    const items = this.items;
    if (items.length === 0) return undefined;
    const first = items[0];
    const last = items.pop();
    if (items.length > 0) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= items.length) break;
        const child = right < items.length && (items[right].priority ?? items[right].cost) < (items[left].priority ?? items[left].cost) ? right : left;
        if ((items[child].priority ?? items[child].cost) >= (last.priority ?? last.cost)) break;
        items[index] = items[child];
        index = child;
      }
      items[index] = last;
    }
    return first;
  }
}

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
  const possibleStartModes = new Set([originStop.transport_mode]);
  // Include any additional mode state attached to this stop without rescanning all connections.
  const originPrefix = `${originStopId}::`;
  for (const state of graphAdjacency.keys()) {
    if (state.startsWith(originPrefix)) possibleStartModes.add(state.slice(originPrefix.length));
  }

  // Label-setting Dijkstra: retain separate labels for each transfer count so
  // a cheap/high-transfer arrival cannot erase a viable low-transfer arrival.
  const queue = new MinHeap();
  const minCost = new Map();
  const destination = stopsById.get(destinationStopId);
  const lowerBound = stopId => {
    const stop = stopsById.get(stopId);
    if (!stop || !destination) return 0;
    const radians = Math.PI / 180;
    const dLat = (destination.latitude - stop.latitude) * radians;
    const dLon = (destination.longitude - stop.longitude) * radians;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(stop.latitude * radians) * Math.cos(destination.latitude * radians) * Math.sin(dLon / 2) ** 2;
    const km = 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    if (objective === 'fastest') return km * 0.4;
    if (objective === 'cheapest') return km * 0.5;
    return km * 0.004;
  };

  for (const startMode of possibleStartModes) {
    const startState = `${originStopId}::${startMode}`;
    const initialWait = configData.assumed_wait_minutes[startMode] || 4;
    const initialRecord = {
      state: startState,
      stopId: originStopId,
      currentMode: startMode,
      currentLineId: null,
      currentBoardingStop: null,
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
    initialRecord.priority = initialRecord.cost + lowerBound(originStopId);
    queue.push(initialRecord);
    minCost.set(routeLabel(startState, 0, null, startMode, null), initialRecord.cost);
  }

  let bestDestRecord = null;
  let expandedLabels = 0;
  const maxExpandedLabels = 75000;

  while (queue.size > 0 && expandedLabels < maxExpandedLabels) {
    expandedLabels++;
    const curr = queue.pop();

    const [currStopId] = curr.state.split('::');
    const currLabel = routeLabel(curr.state, curr.transfers, curr.currentLineId, curr.currentMode, curr.currentBoardingStop);

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

      const routeChange = edge.type === 'ride' && curr.currentLineId != null && curr.currentLineId !== edge.lineId;
      const isTransfer = edge.type === 'transfer' || (curr.currentMode !== nextMode) || routeChange;
      const newTransfers = curr.transfers + (isTransfer ? 1 : 0);
      if (newTransfers > configData.max_transfers) continue;

      const transferPenalty = isTransfer ? configData.transfer_penalty_minutes : 0;
      const boardWait = isTransfer ? (configData.assumed_wait_minutes[nextMode] || 4) : 0;

      const legInVehicle = edge.type === 'ride' ? edge.duration : 0;
      const legWalkTime = edge.type === 'transfer' ? edge.duration : 0;
      const legWalkDist = edge.type === 'transfer' ? (edge.walkingDistanceM || 0) : 0;
      const legFare = edge.fareKnown ? edge.fare : 0;
      let closedSegmentFare = 0;
      let hasUnknownClosedFare = false;
      const closesCurrentRide = curr.currentLineId != null && (edge.type === 'transfer' || routeChange);
      if (closesCurrentRide && curr.currentMode === 'brts') {
        closedSegmentFare = getBrtsAdultFare(curr.currentBoardingStop, currStopId);
        if (closedSegmentFare == null) closedSegmentFare = predictBusFare('brts', curr.currentBoardingStop, currStopId);
        hasUnknownClosedFare = closedSegmentFare == null;
        closedSegmentFare ||= 0;
      } else if (closesCurrentRide && curr.currentMode === 'amts') {
        closedSegmentFare = predictBusFare('amts', curr.currentBoardingStop, currStopId);
        hasUnknownClosedFare = closedSegmentFare == null;
        closedSegmentFare ||= 0;
      }

      const nextBoardingStop = edge.type === 'ride'
        ? curr.currentLineId === edge.lineId ? curr.currentBoardingStop : edge.fromStop
        : null;
      if (edge.type === 'ride' && edge.toStop === destinationStopId) {
        if (edge.mode === 'brts') {
          const finalFare = getBrtsAdultFare(nextBoardingStop, edge.toStop) ?? predictBusFare('brts', nextBoardingStop, edge.toStop);
          if (finalFare == null) hasUnknownClosedFare = true;
          else closedSegmentFare += finalFare;
        } else if (edge.mode === 'amts') {
          const finalFare = predictBusFare('amts', nextBoardingStop, edge.toStop);
          if (finalFare == null) hasUnknownClosedFare = true;
          else closedSegmentFare += finalFare;
        }
      }
      // An incomplete fare is never treated as zero when ranking cheapest routes.
      if (objective === 'cheapest' && hasUnknownClosedFare) continue;
      const stepFare = legFare + closedSegmentFare;
      const legDistanceKm = edge.distanceKm || 0;

      const newTotalTime = curr.totalTime + edge.duration + transferPenalty + boardWait;
      const newInVehicle = curr.inVehicleTime + legInVehicle;
      const newWalkingTime = curr.walkingTime + legWalkTime;
      const newWaitTime = curr.waitWaitTime + boardWait;
      const newFare = curr.totalFare + stepFare;
      const newDistKm = curr.totalDistanceKm + legDistanceKm;
      const newWalkDistM = curr.walkingDistanceM + legWalkDist;

      // Additive objective costs keep Dijkstra's ordering valid. Balanced uses
      // normalized time, estimated fare, transfers, and walking distance.
      const elapsedDelta = edge.duration + transferPenalty + boardWait;
      const stepCost = objective === 'fastest'
        ? elapsedDelta
        : objective === 'cheapest'
          ? stepFare + (elapsedDelta * 0.001)
          : (0.4 * elapsedDelta / 60) + (0.4 * stepFare / 35)
            + (isTransfer ? 0.15 : 0) + (0.05 * legWalkDist / 500);
      const nextCost = curr.cost + stepCost;
      const nextLineId = edge.type === 'ride' ? edge.lineId : null;
      const nextLabel = routeLabel(nextState, newTransfers, nextLineId, nextMode, nextBoardingStop);

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
          currentLineId: nextLineId,
          currentBoardingStop: nextBoardingStop,
          cost: nextCost,
          priority: nextCost + lowerBound(nextStopId),
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

  const finalizeRide = leg => {
    if (!leg) return leg;
    if (leg.mode === 'brts') {
      const actualFare = getBrtsAdultFare(leg.fromStop, leg.toStop);
      const fare = actualFare ?? predictBusFare('brts', leg.fromStop, leg.toStop);
      leg.fare = fare;
      leg.fareKnown = actualFare != null;
      leg.fareEstimated = actualFare == null && fare != null;
      leg.fareSource = actualFare != null ? 'community_gtfs_adult_area_fare' : leg.fareEstimated ? 'distance_prediction' : null;
    } else if (leg.mode === 'amts') {
      leg.fare = predictBusFare('amts', leg.fromStop, leg.toStop);
      leg.fareKnown = false;
      leg.fareEstimated = leg.fare != null;
      leg.fareSource = leg.fareEstimated ? 'distance_prediction' : null;
    }
    return leg;
  };

  for (let i = 0; i < record.path.length; i++) {
    const item = record.path[i];

    if (item.type === 'ride') {
      if (currentRideLeg && currentRideLeg.mode === item.mode && currentRideLeg.lineId === item.lineId) {
        // Extend existing ride leg on same line
        currentRideLeg.toStop = item.toStop;
        currentRideLeg.stopCount += 1;
        currentRideLeg.intermediateStops.push(item.fromStop);
        currentRideLeg.durationMinutes += item.duration;
        if (!item.fareKnown) {
          currentRideLeg.fare = null;
          currentRideLeg.fareKnown = false;
        } else if (currentRideLeg.fareKnown) currentRideLeg.fare += item.fare;
        currentRideLeg.distanceKm += item.distanceKm;
      } else {
        if (currentRideLeg) {
          legs.push(finalizeRide(currentRideLeg));
          if (currentRideLeg.mode === item.mode && currentRideLeg.toStop === item.fromStop) {
            legs.push({
              type: 'transfer',
              fromStop: item.fromStop,
              toStop: item.fromStop,
              fromMode: item.mode,
              toMode: item.mode,
              walkingDistanceM: 0,
              durationMinutes: (item.boardWait || 0) + (item.transferPenalty || 0),
              fare: 0,
              isRouteChange: true,
              routeShortName: item.route_short_name || null
            });
          }
        }
        currentRideLeg = {
          type: 'ride',
          mode: item.mode,
          lineId: item.lineId,
          fromStop: item.fromStop,
          toStop: item.toStop,
          stopCount: 1,
          intermediateStops: [],
          durationMinutes: item.duration,
          fare: item.fareKnown ? item.fare : null,
          fareKnown: item.fareKnown,
          routeShortName: item.route_short_name || null,
          routeLongName: item.route_long_name || null,
          distanceKm: item.distanceKm
        };
      }
    } else if (item.type === 'transfer') {
      if (currentRideLeg) {
        legs.push(finalizeRide(currentRideLeg));
        currentRideLeg = null;
      }
      legs.push({
        type: 'transfer',
        fromStop: item.fromStop,
        toStop: item.toStop,
        fromMode: item.fromMode,
        toMode: item.toMode,
        walkingDistanceM: item.walkingDistanceM,
        durationMinutes: item.duration + (item.boardWait || 0) + (item.transferPenalty || 0),
        fare: 0,
        isLongWalk: (item.walkingDistanceM || 0) >= configData.long_walk_threshold_m
      });
    }
  }

  if (currentRideLeg) {
    legs.push(finalizeRide(currentRideLeg));
  }

  // Calculate operator fares
  const operatorFares = legs
    .filter(l => l.type === 'ride')
    .map(l => ({ operator: l.mode, fare: l.fareKnown ? l.fare : null, estimate: l.fareEstimated ? l.fare : null }));

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
      + (0.4 * fareBreakdown.estimatedTotal / 35)
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
    { key: 'cheapest', label: 'LOWEST ESTIMATED FARE', reason: 'Lowest estimate using known fares and distance-based bus predictions' }
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
