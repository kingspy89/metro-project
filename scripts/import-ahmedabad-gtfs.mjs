import fs from 'node:fs';
import path from 'node:path';

const [,, feedDir = '.gtfs_work'] = process.argv;
const readCsv = file => {
  const content = fs.readFileSync(path.join(feedDir, file), 'utf8').replace(/^\uFEFF/, '').trim();
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (quoted) {
      if (char === '"' && content[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const [header, ...records] = rows;
  return records.map(values => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])));
};
const timeSeconds = value => {
  if (!value) return null;
  const [hours, minutes, seconds] = value.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};
const median = values => {
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
};
const distanceKm = (a, b) => {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLon = (b.lon - a.lon) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
const saveJson = (name, value) => fs.writeFileSync(path.join('src/data', name), `${JSON.stringify(value)}\n`);
const readJson = name => JSON.parse(fs.readFileSync(path.join('src/data', name), 'utf8'));

const agencies = new Map(readCsv('agency.txt').map(a => [a.agency_id, a]));
const routes = readCsv('routes.txt').filter(r => ['AMTS', 'AJL'].includes(r.agency_id));
const routeById = new Map(routes.map(r => [r.route_id, r]));
const allStops = readCsv('stops.txt');
const stopById = new Map(allStops.map(s => [s.stop_id, s]));
const trips = readCsv('trips.txt').filter(t => routeById.has(t.route_id));
const tripById = new Map(trips.map(t => [t.trip_id, t]));
const serviceDates = readCsv('calendar.txt');
const valid = serviceDates.reduce((acc, c) => ({ start: acc.start ? (c.start_date < acc.start ? c.start_date : acc.start) : c.start_date, end: acc.end ? (c.end_date > acc.end ? c.end_date : acc.end) : c.end_date }), { start: '', end: '' });

const stopTimesByTrip = new Map();
for (const st of readCsv('stop_times.txt')) {
  if (!tripById.has(st.trip_id)) continue;
  if (!stopTimesByTrip.has(st.trip_id)) stopTimesByTrip.set(st.trip_id, []);
  stopTimesByTrip.get(st.trip_id).push(st);
}

const edgeSamples = new Map();
const routePatterns = new Map();
const servedRoutes = new Map();
const servedRouteDirections = new Map();
for (const trip of trips) {
  const sequence = (stopTimesByTrip.get(trip.trip_id) || []).sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
  if (sequence.length < 2) continue;
  const patternKey = `${trip.route_id}::${trip.direction_id || '0'}`;
  const currentPattern = routePatterns.get(patternKey);
  if (!currentPattern || sequence.length > currentPattern.length) routePatterns.set(patternKey, sequence.map(s => s.stop_id));
  for (const st of sequence) {
    if (!servedRoutes.has(st.stop_id)) servedRoutes.set(st.stop_id, new Set());
    servedRoutes.get(st.stop_id).add(trip.route_id);
    if (!servedRouteDirections.has(st.stop_id)) servedRouteDirections.set(st.stop_id, new Set());
    servedRouteDirections.get(st.stop_id).add(`${trip.route_id}::${trip.direction_id || '0'}`);
  }
  for (let i = 0; i < sequence.length - 1; i++) {
    const from = sequence[i], to = sequence[i + 1];
    if (!stopById.has(from.stop_id) || !stopById.has(to.stop_id) || from.stop_id === to.stop_id) continue;
    const direction = trip.direction_id || '0';
    const key = `${trip.route_id}\u0000${direction}\u0000${from.stop_id}\u0000${to.stop_id}`;
    const fromTime = timeSeconds(from.departure_time || from.arrival_time);
    let toTime = timeSeconds(to.arrival_time || to.departure_time);
    if (fromTime != null && toTime != null && toTime < fromTime) toTime += 86400;
    const scheduledMinutes = fromTime != null && toTime != null ? Math.max(0.5, (toTime - fromTime) / 60) : null;
    if (!edgeSamples.has(key)) edgeSamples.set(key, { route: trip.route_id, direction, from: from.stop_id, to: to.stop_id, durations: [] });
    if (scheduledMinutes != null && scheduledMinutes < 180) edgeSamples.get(key).durations.push(scheduledMinutes);
  }
}

const validStops = [...new Set([...edgeSamples.values()].flatMap(e => [e.from, e.to]))].map(id => stopById.get(id));
const coords = validStops.map(s => ({ lat: Number(s.stop_lat), lon: Number(s.stop_lon) })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
const minLat = Math.min(...coords.map(p => p.lat)), maxLat = Math.max(...coords.map(p => p.lat));
const minLon = Math.min(...coords.map(p => p.lon)), maxLon = Math.max(...coords.map(p => p.lon));
const project = (lat, lon) => ({
  x: 80 + (Number(lon) - minLon) / Math.max(0.001, maxLon - minLon) * 1480,
  y: 80 + (maxLat - Number(lat)) / Math.max(0.001, maxLat - minLat) * 820
});

const busStops = validStops.map(stop => {
  const lat = Number(stop.stop_lat), lon = Number(stop.stop_lon);
  const point = project(lat, lon);
  const agencyIds = [...new Set([...(servedRoutes.get(stop.stop_id) || [])].map(routeId => routeById.get(routeId)?.agency_id).filter(Boolean))];
  const interchange = (servedRoutes.get(stop.stop_id)?.size || 0) >= 6;
  return {
    stop_id: stop.stop_id,
    stop_name: stop.stop_name,
    stop_name_gu: '',
    transport_mode: agencyIds.includes('AJL') ? 'brts' : 'amts',
    line_id: null,
    agency_ids: agencyIds,
    latitude: lat,
    longitude: lon,
    schematic_x: Math.round(point.x * 10) / 10,
    schematic_y: Math.round(point.y * 10) / 10,
    is_interchange: interchange,
    label_pos: 'top',
    source: 'community_gtfs',
    route_count: servedRoutes.get(stop.stop_id)?.size || 0
  };
});
const routeDirectionKeys = [...new Set(trips.map(trip => `${trip.route_id}::${trip.direction_id || '0'}`))];
const directionLineId = (route, direction) => `GTFS_${route.agency_id}_${route.route_id}_${direction}`;
const edges = [];
for (const sample of edgeSamples.values()) {
  const route = routeById.get(sample.route);
  const from = stopById.get(sample.from), to = stopById.get(sample.to);
  const dKm = distanceKm({ lat: Number(from.stop_lat), lon: Number(from.stop_lon) }, { lat: Number(to.stop_lat), lon: Number(to.stop_lon) });
  const duration = median(sample.durations) ?? Math.max(1, dKm / 18 * 60);
  edges.push({
    from_stop_id: sample.from,
    to_stop_id: sample.to,
    transport_mode: route.agency_id === 'AJL' ? 'brts' : 'amts',
    line_id: directionLineId(route, sample.direction),
    duration_minutes: Math.round(duration * 10) / 10,
    fare: null,
    fare_known: false,
    distance_km: Math.round(dKm * 100) / 100,
    route_short_name: route.route_short_name,
    source: 'community_gtfs'
  });
}
const lines = routeDirectionKeys.map(key => {
  const [routeId, direction] = key.split('::');
  const route = routeById.get(routeId);
  return {
    line_id: directionLineId(route, direction),
    route_id: route.route_id,
    direction_id: direction,
    line_name: `${agencies.get(route.agency_id)?.agency_name || route.agency_id} · ${route.route_short_name}`,
    route_short_name: route.route_short_name,
    route_long_name: route.route_long_name,
    mode: route.agency_id === 'AJL' ? 'brts' : 'amts',
    agency_id: route.agency_id,
    colour_token: route.agency_id === 'AJL' ? '--line-brts' : '--line-amts',
    colour_hex: route.agency_id === 'AJL' ? '#10B981' : '#F59E0B',
    description: route.route_long_name,
    source: 'community_gtfs'
  };
});
const busStopIndex = new Map(busStops.map((stop, index) => [stop.stop_id, index]));
const busLineIndex = new Map(lines.map((line, index) => [line.line_id, index]));
const busStopIds = new Set(busStops.map(s => s.stop_id));
const patterns = [...routePatterns.entries()].map(([key, ids]) => {
  const routeId = key.split('::')[0];
  const lineId = directionLineId(routeById.get(routeId), key.split('::')[1]);
  return [busLineIndex.get(lineId), key.split('::')[1], ids.filter(id => busStopIds.has(id)).map(id => busStopIndex.get(id))];
});
const feedInfo = readCsv('feed_info.txt')[0];
const areaRows = readCsv('areas.txt');
const areaIndex = new Map(areaRows.map((area, index) => [area.area_id, index]));
const adultFareMatrix = areaRows.map(() => Array(areaRows.length).fill(null));
const adultProducts = new Map(readCsv('fare_products.txt')
  .filter(product => product.rider_category_id === 'BRTS_ADULT' && product.currency === 'INR')
  .map(product => [product.fare_product_id, Number(product.amount)]));
for (const rule of readCsv('fare_leg_rules.txt')) {
  const fare = adultProducts.get(rule.fare_product_id);
  const fromArea = areaIndex.get(rule.from_area_id);
  const toArea = areaIndex.get(rule.to_area_id);
  if (fare != null && fromArea != null && toArea != null) adultFareMatrix[fromArea][toArea] = fare;
}
const stopAreaIndexes = new Map(readCsv('stop_areas.txt').map(record => [record.stop_id, areaIndex.get(record.area_id)]));
const metadata = {
  source_name: 'Ahmedabad AMTS and AJL GTFS community compilation',
  source_url: 'https://github.com/croyla/amd-gtfs',
  source_detail: 'Compiled from AMTS and Ahmedabad Janmarg Limited public websites; this is not an operator-hosted live feed.',
  attribution: 'GTFS compilation by croyla/amd-gtfs; source data credited to amts.co.in and ahmedabadbrts.org.',
  validity_start: valid.start || feedInfo.feed_start_date,
  validity_end: valid.end || feedInfo.feed_end_date,
  imported_at: new Date().toISOString().slice(0, 10),
  agencies: ['AMTS', 'AJL'],
  stops: busStops.length,
  routes: routes.length,
  patterns: patterns.length,
  directed_edges: edges.length,
  fare_note: 'Adult BRTS area-pair fares are included where both stops have fare zones. AMTS fares are not in the feed. Any unavailable fare is omitted and never represented as zero.'
};

const metroStops = readJson('stops.json').filter(stop => stop.transport_mode === 'metro');
for (const stop of metroStops) {
  const point = project(stop.latitude, stop.longitude);
  stop.schematic_x = Math.round(point.x * 10) / 10;
  stop.schematic_y = Math.round(point.y * 10) / 10;
  stop.source = 'metro_prototype_unverified';
}
const metroConnections = readJson('connections.json').filter(edge => edge.transport_mode === 'metro');
const metroLines = readJson('lines.json').filter(line => line.mode === 'metro');
const allStopsForMap = [...metroStops, ...busStops];
const transfers = [];
for (const metro of metroStops) {
  const nearest = busStops
    .map(stop => ({ stop, distance: distanceKm({ lat: metro.latitude, lon: metro.longitude }, { lat: stop.latitude, lon: stop.longitude }) * 1000 }))
    .filter(candidate => candidate.distance <= 450)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 2);
  for (const { stop, distance } of nearest) {
    const meters = Math.round(distance);
    const minutes = Math.max(1, Math.ceil(meters / 70));
    transfers.push({ from_stop_id: metro.stop_id, to_stop_id: stop.stop_id, walking_distance_m: meters, walking_time_minutes: minutes, source: 'coordinate_proximity_estimate' });
    transfers.push({ from_stop_id: stop.stop_id, to_stop_id: metro.stop_id, walking_distance_m: meters, walking_time_minutes: minutes, source: 'coordinate_proximity_estimate' });
  }
}

saveJson('stops.json', allStopsForMap);
saveJson('connections.json', metroConnections);
saveJson('lines.json', [...metroLines, ...lines]);
saveJson('transfers.json', transfers);
saveJson('gtfs_bus_patterns.json', patterns);
saveJson('gtfs_metadata.json', metadata);
saveJson('gtfs_bus_stop_ids.json', busStops.map(stop => stop.stop_id));
saveJson('all_stop_ids.json', allStopsForMap.map(stop => stop.stop_id));
saveJson('gtfs_bus_stop_routes.json', busStops.map(stop => [...(servedRouteDirections.get(stop.stop_id) || [])].map(key => {
  const [routeId, direction] = key.split('::');
  return busLineIndex.get(directionLineId(routeById.get(routeId), direction));
})));
saveJson('gtfs_bus_stop_area_indexes.json', busStops.map(stop => stopAreaIndexes.get(stop.stop_id) ?? -1));
saveJson('gtfs_brts_adult_fares.json', { area_ids: areaRows.map(area => area.area_id), adult_fares: adultFareMatrix });
saveJson('gtfs_bus_edges.json', edges.map(edge => [
  busStopIndex.get(edge.from_stop_id),
  busStopIndex.get(edge.to_stop_id),
  busLineIndex.get(edge.line_id),
  Math.round(edge.duration_minutes * 10),
  Math.round(edge.distance_km * 100)
]));
console.log(JSON.stringify(metadata, null, 2));
