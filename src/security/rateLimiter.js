/**
 * YatraOne Client & Endpoint Rate Limiter (Token Bucket / Sliding Window)
 * Defends APIs and computational search endpoints against automated spam and denial-of-service.
 */

class RateLimiter {
  constructor(maxRequests = 20, timeWindowMs = 10000) {
    this.maxRequests = maxRequests;
    this.timeWindowMs = timeWindowMs;
    this.requests = [];
  }

  isAllowed() {
    const now = Date.now();
    // Prune requests outside the current time window
    this.requests = this.requests.filter(t => now - t < this.timeWindowMs);

    if (this.requests.length >= this.maxRequests) {
      return {
        allowed: false,
        retryAfterMs: Math.ceil((this.requests[0] + this.timeWindowMs - now) / 1000) * 1000,
        currentCount: this.requests.length
      };
    }

    this.requests.push(now);
    return {
      allowed: true,
      remaining: this.maxRequests - this.requests.length,
      currentCount: this.requests.length
    };
  }

  getStatus() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.timeWindowMs);
    return {
      activeCount: this.requests.length,
      maxLimit: this.maxRequests,
      windowSeconds: this.timeWindowMs / 1000
    };
  }
}

export const searchRateLimiter = new RateLimiter(15, 10000); // 15 requests per 10s
