import { generateCandidateJourneys } from './graph.js';

self.addEventListener('message', ({ data }) => {
  const { requestId, originStopId, destinationStopId } = data;
  try {
    const result = generateCandidateJourneys(originStopId, destinationStopId);
    self.postMessage({ requestId, result });
  } catch (error) {
    self.postMessage({ requestId, error: error instanceof Error ? error.message : String(error) });
  }
});
