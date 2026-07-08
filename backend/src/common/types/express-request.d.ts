// Augment Express's Request with the per-request correlation id assigned by the request
// logger middleware, so the exception filter (and any handler) can read it in a typed way.
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export {};
