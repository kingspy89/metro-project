/**
 * YatraOne Security & Input Sanitizer
 * Defends against XSS, injection vectors, and malformed inputs.
 */

export function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function validateStopId(stopId, validIdsSet) {
  if (!stopId || typeof stopId !== 'string') return false;
  // Clean alphanumeric check
  const clean = stopId.trim();
  return validIdsSet.has(clean);
}
