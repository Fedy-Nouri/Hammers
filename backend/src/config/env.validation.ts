/**
 * Fail-fast validation of boot-critical environment variables. Wired into
 * ConfigModule.forRoot({ validate }) — if anything is missing or malformed the app aborts
 * before it starts listening, with a single message naming every problem, instead of
 * failing later in a confusing way (e.g. a cryptic auth or DB error at request time).
 *
 * Only variables the app genuinely cannot run without are required. Integration keys
 * (OpenAI, Stripe, Resend, Google, Azure, Deepgram, …) stay optional on purpose: their
 * services are written to degrade gracefully when a key is absent.
 */
export function validate(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];

  const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  for (const key of required) {
    const value = config[key];
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push(`${key} is required and must be a non-empty string`);
    }
  }

  // ENCRYPTION_KEY is optional (only the Google integration uses it), but when provided it
  // must be a 32-byte key expressed as 64 hex characters (AES-256-GCM).
  const encryptionKey = config['ENCRYPTION_KEY'];
  if (
    typeof encryptionKey === 'string' &&
    encryptionKey !== '' &&
    !/^[0-9a-fA-F]{64}$/.test(encryptionKey)
  ) {
    errors.push('ENCRYPTION_KEY must be 64 hex characters (32 bytes) when set');
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${errors.join('\n  - ')}\n` +
        'See backend/.env.example for the full list of variables.',
    );
  }

  return config;
}
