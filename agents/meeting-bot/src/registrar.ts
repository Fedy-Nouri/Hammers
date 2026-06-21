import axios from 'axios';

const HEARTBEAT_MS = 30_000;

export interface RegistrarOptions {
  backendUrl: string;
  secret: string;
  botId: string;
  selfUrl: string;
  label?: string;
}

/**
 * Registers this bot container with the backend fleet registry on startup and
 * sends periodic heartbeats so the backend knows it is online and reachable.
 * Returns a stop function that clears the heartbeat timer.
 */
export function startRegistrar(opts: RegistrarOptions): () => void {
  const { backendUrl, secret, botId, selfUrl, label } = opts;
  const headers = { 'x-bot-secret': secret };

  const register = async (): Promise<void> => {
    try {
      await axios.post(
        `${backendUrl}/api/bot/instances/register`,
        { botId, baseUrl: selfUrl, label },
        { headers, timeout: 10_000 },
      );
      console.log(`[registrar] Registered ${botId} @ ${selfUrl}`);
    } catch (err) {
      console.error('[registrar] register failed:', err instanceof Error ? err.message : err);
    }
  };

  const heartbeat = async (): Promise<void> => {
    try {
      await axios.post(
        `${backendUrl}/api/bot/instances/heartbeat`,
        { botId },
        { headers, timeout: 10_000 },
      );
    } catch (err) {
      console.error('[registrar] heartbeat failed:', err instanceof Error ? err.message : err);
    }
  };

  void register();
  const timer = setInterval(() => void heartbeat(), HEARTBEAT_MS);
  return () => clearInterval(timer);
}
