export async function consumePostSseStream<
  TEvent extends Record<string, unknown>,
>(
  url: string,
  body: Record<string, unknown>,
  onEvent: (event: TEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) errMsg = data.error;
    } catch {
      // ignore non-json error body
    }
    throw new Error(errMsg);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('Brak strumienia odpowiedzi z serwera lokalnego.');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const rawBlock = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      for (const rawLine of rawBlock.split(/\r?\n/)) {
        if (rawLine.startsWith('data:')) {
          const jsonText = rawLine.slice(5).trim();
          if (!jsonText) continue;
          try {
            const parsed = JSON.parse(jsonText) as TEvent;
            onEvent(parsed);
          } catch {
            // ignore partial/non-JSON keepalive
          }
        }
      }

      boundary = buffer.indexOf('\n\n');
    }
  }
}
