/**
 * Reads a `text/event-stream` response body and yields each `data:` payload
 * parsed as JSON. Terminates on a `data: [DONE]` sentinel. Malformed chunks are
 * skipped. Shared by the AI chat stream and the live transcript stream.
 */
export async function* readSSEData<T>(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<T> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    if (signal?.aborted) return
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') return
      try {
        yield JSON.parse(raw) as T
      } catch {
        // ignore malformed chunks
      }
    }
  }
}
