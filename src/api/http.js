export class ApiError extends Error {
  /**
   * @param {string} message  человекочитаемое сообщение (показывается в UI)
   * @param {{ source?: string, status?: number, code?: string }} [info]
   */
  constructor(message, { source, status, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.source = source;
    this.status = status;
    this.code = code;
  }
}

export const isAbortError = (e) => e?.name === 'AbortError';

/** fetch + JSON + понятные ошибки. Отмена через AbortSignal пробрасывается как AbortError. */
export async function fetchJson(url, { method = 'GET', headers, body, signal, source = 'API' } = {}) {
  let res;
  try {
    res = await fetch(url, { method, headers, body, signal });
  } catch (e) {
    if (isAbortError(e)) throw e;
    throw new ApiError(`${source}: не удалось связаться с сервисом — он недоступен или запрос режет блокировщик рекламы/VPN`, {
      source,
      code: 'NETWORK',
    });
  }

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.status_message || data?.error || data?.detail || data?.errors?.[0]?.message || '';
    } catch {
      /* тело не JSON — игнорируем */
    }
    const reason =
      res.status === 401 || res.status === 403
        ? 'неверный API-ключ'
        : res.status === 429
          ? 'слишком много запросов, подождите минуту'
          : res.status >= 500
            ? `сервис временно недоступен (${res.status})`
            : `ошибка ${res.status}`;
    throw new ApiError(`${source}: ${reason}${detail ? ` — ${detail}` : ''}`, { source, status: res.status });
  }

  return res.json();
}

export function missingKeyError(source) {
  return new ApiError(`${source}: не указан API-ключ`, { source, code: 'NO_KEY' });
}
