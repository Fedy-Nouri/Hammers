/** DI token for the shared ioredis client (or null when REDIS_URL is unset). */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
