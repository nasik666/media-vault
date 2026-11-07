/**
 * Минимальный клиент GitHub Gist API (CORS разрешён для любого origin).
 * Токен: classic personal access token с правом «gist»
 * или fine-grained token с доступом «Gists: Read and write».
 */
const API = 'https://api.github.com';
export const GIST_FILE = 'mediavault.json';
const DESCRIPTION = 'MediaVault — синхронизация библиотеки (не удаляйте)';

export const NEW_TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=gist&description=MediaVault%20sync';

export class SyncError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
  }
}

async function gh(token, path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store', // иначе браузер может отдать устаревший gist из кэша
    });
  } catch {
    throw new SyncError('GitHub недоступен — проверьте интернет', 'NETWORK');
  }

  if (res.status === 401) throw new SyncError('Токен GitHub недействителен или отозван', 'AUTH');
  if (res.status === 404) throw new SyncError('Gist не найден', 'NOT_FOUND');
  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    throw new SyncError(
      remaining === '0' ? 'Превышен лимит запросов GitHub, попробуйте позже' : 'У токена нет доступа к gist',
      'FORBIDDEN',
    );
  }
  if (!res.ok) throw new SyncError(`GitHub: ошибка ${res.status}`, 'HTTP');
  return { data: res.status === 204 ? null : await res.json(), headers: res.headers };
}

/** Проверяет токен. Возвращает логин; бросает ошибку, если у classic-токена нет права gist. */
export async function getUser(token) {
  const { data, headers } = await gh(token, '/user');
  const scopes = headers.get('x-oauth-scopes'); // есть только у classic-токенов
  if (scopes != null && !scopes.split(',').map((s) => s.trim()).includes('gist')) {
    throw new SyncError('У токена нет права «gist» — создайте новый с этой галочкой', 'SCOPE');
  }
  return data.login;
}

/** Ищет gist MediaVault среди gist'ов пользователя. */
export async function findGist(token) {
  for (let page = 1; page <= 10; page += 1) {
    const { data } = await gh(token, `/gists?per_page=100&page=${page}`);
    const found = data.find((g) => g.files?.[GIST_FILE]);
    if (found) return found.id;
    if (data.length < 100) return null;
  }
  return null;
}

/** Читает и разбирает файл синхронизации. null — если файла в gist нет. */
export async function readGist(token, gistId) {
  const { data } = await gh(token, `/gists/${gistId}`);
  const file = data.files?.[GIST_FILE];
  if (!file) return null;
  let content = file.content;
  if (file.truncated) {
    // Больше ~1 МБ API отдаёт обрезанным — берём полный raw-файл.
    const raw = await fetch(file.raw_url, { cache: 'no-store' }).catch(() => null);
    if (!raw?.ok) throw new SyncError('Не удалось скачать файл синхронизации', 'HTTP');
    content = await raw.text();
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new SyncError('Файл синхронизации в gist повреждён', 'CORRUPT');
  }
}

export async function createGist(token, payload) {
  const { data } = await gh(token, '/gists', {
    method: 'POST',
    body: { description: DESCRIPTION, public: false, files: { [GIST_FILE]: { content: JSON.stringify(payload) } } },
  });
  return { id: data.id, url: data.html_url };
}

export async function writeGist(token, gistId, payload) {
  await gh(token, `/gists/${gistId}`, {
    method: 'PATCH',
    body: { files: { [GIST_FILE]: { content: JSON.stringify(payload) } } },
  });
}
