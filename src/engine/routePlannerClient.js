let worker;
let nextRequestId = 0;
const pendingRequests = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./routePlanner.worker.js', import.meta.url), { type: 'module' });
  worker.addEventListener('message', ({ data }) => {
    const pending = pendingRequests.get(data.requestId);
    if (!pending) return;
    pendingRequests.delete(data.requestId);
    if (data.error) pending.reject(new Error(data.error));
    else pending.resolve(data.result);
  });
  worker.addEventListener('error', event => {
    const error = new Error(event.message || 'The route planner worker stopped unexpectedly.');
    for (const pending of pendingRequests.values()) pending.reject(error);
    pendingRequests.clear();
    worker?.terminate();
    worker = undefined;
  });
  return worker;
}

export function findJourneysInWorker(originStopId, destinationStopId) {
  const requestId = ++nextRequestId;
  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    try {
      getWorker().postMessage({ requestId, originStopId, destinationStopId });
    } catch (error) {
      pendingRequests.delete(requestId);
      reject(error);
    }
  });
}
