import { validate } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'secret',
  JWT_REFRESH_SECRET: 'refresh',
};

describe('validate (env)', () => {
  it('passes when the required vars are present', () => {
    expect(() => validate({ ...base })).not.toThrow();
  });

  it('throws once, naming every missing required var', () => {
    expect(() => validate({})).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET[\s\S]*JWT_REFRESH_SECRET/);
  });

  it('rejects a malformed ENCRYPTION_KEY but accepts a 64-hex one', () => {
    expect(() => validate({ ...base, ENCRYPTION_KEY: 'too-short' })).toThrow(/ENCRYPTION_KEY/);
    expect(() => validate({ ...base, ENCRYPTION_KEY: 'a'.repeat(64) })).not.toThrow();
  });

  it('does not require optional integration keys (OpenAI/Stripe/Resend/…)', () => {
    expect(() => validate({ ...base })).not.toThrow();
  });
});
