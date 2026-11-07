# MediaVault

Личный трекер фильмов, сериалов, игр и аниме с конструктором тир-листов.
SPA работает целиком в браузере и рассчитано на GitHub Pages: бэкенда нет, данные лежат в `localStorage`, бэкап делается в JSON.

- **Поиск с автокомплитом**: TMDB (фильмы/сериалы, RU/EN), Википедия (игры, без ключа; RAWG — по выбору), AniList GraphQL (аниме, без ключа).
- **Ручное добавление**: любой тайтл, которого нет в источниках (название, год, ссылка на постер). У любой записи можно поправить название, год и обложку.
- **Библиотека**: фильтры по типу и статусу, сортировка, быстрая смена статуса и оценки прямо на карточке.
- **Тир-листы**: несколько досок с фильтрами, свои ранги (название и цвет), drag-and-drop (мышь, тач, клавиатура), экспорт в PNG.
- **Синхронизация между устройствами** через секретный GitHub Gist: ПК, Mac и телефон видят одну библиотеку. Нужен только токен GitHub с правом `gist`.
- **Данные**: экспорт и импорт всей базы в `.json` (с объединением или заменой).
- **Экспорт оценок**: таблица CSV для Excel и Google Таблиц или текстовый список в буфер обмена («9/10 · Название (2024) · Просмотрено»). В библиотеке выгружается то, что видно с текущими фильтрами, в настройках — вся база.

---

## 1. Пошаговый план с нуля

> Если вы просто клонировали этот репозиторий, выполните шаг 0, затем `npm install` и переходите к шагу 6.

### 0. Node.js
Установите Node.js LTS (22 или 24): https://nodejs.org или на Windows
```bash
winget install OpenJS.NodeJS.LTS
```
Проверка: `node -v` и `npm -v`.

### 1. Каркас Vite + React
```bash
npm create vite@latest media-vault -- --template react
```
```bash
cd media-vault
```
```bash
npm install
```

### 2. Tailwind CSS v4
```bash
npm install -D tailwindcss @tailwindcss/vite
```
`vite.config.js`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // относительные пути, чтобы работало на https://<user>.github.io/<repo>/
});
```
`src/index.css`: первая строка `@import "tailwindcss";`. Файл `tailwind.config.js` в v4 не нужен.

### 3. Зависимости приложения
```bash
npm install lucide-react @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities html2canvas-pro@^1.6.7
```
(`html2canvas-pro@2.x` требует Node 24 — ветка 1.x стабильна и полностью подходит.)
```bash
npm install -D gh-pages
```

### 4. Код
Удалите шаблонные `src/App.css` и `src/assets`, затем перенесите `src/` по структуре из раздела 2.

### 5. Скрипты деплоя в `package.json`
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}
```

### 6. Локальный запуск
```bash
npm run dev
```
Откройте http://localhost:5173, нажмите ⚙ и вставьте ключ. Его вводят один раз: браузер запоминает ключ в localStorage.
- **TMDB**: https://www.themoviedb.org/settings/api. Подходит и *API Key* (v3), и *API Read Access Token* (v4, начинается с `eyJ`).
- **Игры** по умолчанию ищутся в Википедии без ключа. RAWG (https://rawg.io/apidocs) можно включить в настройках.
- **AniList** работает без ключа.

### 7. Репозиторий на GitHub
```bash
git init
```
```bash
git add -A
```
```bash
git commit -m "MediaVault: first version"
```
```bash
gh repo create media-vault --public --source=. --push
```
Без `gh` CLI: создайте пустой репозиторий на github.com и выполните `git remote add origin https://github.com/<user>/media-vault.git && git push -u origin main`.

### 8. Деплой через gh-pages
```bash
npm run deploy
```
Команда соберёт `dist/` и запушит его в ветку `gh-pages`. Затем на GitHub откройте **Settings → Pages → Build and deployment → Source: Deploy from a branch**, выберите ветку `gh-pages` и папку `/ (root)`.
Через минуту сайт появится на `https://<user>.github.io/media-vault/`. Для обновления повторите `npm run deploy`.

<details>
<summary>Альтернатива: автодеплой через GitHub Actions</summary>

Создайте `.github/workflows/deploy.yml`, а в **Settings → Pages → Source** выберите **GitHub Actions**. `npm ci` требует закоммиченный `package-lock.json`.

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```
</details>

---

## Синхронизация между устройствами

1. Создайте токен: https://github.com/settings/tokens/new?scopes=gist&description=MediaVault%20sync — галочка `gist` уже стоит. Срок (Expiration) — «No expiration» или любой; когда истечёт, просто вставьте новый.
2. На сайте: ⚙ → «Синхронизация между устройствами» → вставьте токен → «Подключить».
3. На остальных устройствах — то же самое с тем же токеном. Библиотека, тир-листы и (по галочке) ключ TMDB подтянутся сами.

Как это работает:
- Данные лежат в секретном gist `mediavault.json` в вашем аккаунте. Секретный gist не виден в поиске и профиле, но открывается по прямой ссылке.
- Синхронизация запускается при открытии сайта, через 2.5 с после любой правки, при возвращении на вкладку и раз в 2 минуты.
- Конфликты: тайтлы сливаются по `uid`, тир-листы по `id`, при правке одной записи на двух устройствах побеждает более свежая. Удаления распространяются отметками (`tombstones`) — удалённое на телефоне не «воскреснет» с ПК.
- Токен хранится только в localStorage этого браузера и никогда не попадает ни в gist, ни в JSON-бэкап. Значок облака в шапке показывает состояние; клик — синхронизировать сейчас.

---

## 2. Структура проекта

```
media-vault/
├── index.html
├── package.json
├── vite.config.js                 # react + tailwind, base: './'
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx                   # ToastProvider → StoreProvider → App
    ├── App.jsx                    # вкладки (#/library, #/tiers), модалки
    ├── index.css                  # @import "tailwindcss"
    ├── constants.js               # типы медиа, статусы, ранги по умолчанию
    ├── api/
    │   ├── http.js                # fetchJson + ApiError (понятные ошибки, AbortSignal)
    │   ├── tmdb.js                # фильмы/сериалы, v3-ключ или v4-токен
    │   ├── wikipedia.js           # игры без ключа: ru+en Википедия, склейка по Викиданным
    │   ├── rawg.js                # игры через RAWG (опционально, + ресайз картинок)
    │   ├── anilist.js             # аниме (GraphQL)
    │   └── search.js              # единый поиск по категориям, Promise.allSettled
    ├── store/
    │   ├── StoreContext.jsx       # Context + useReducer + автосохранение в localStorage
    │   ├── reducer.js             # действия над библиотекой и тир-листами
    │   ├── storage.js             # загрузка/сохранение, санитайзеры, экспорт/импорт/merge
    │   └── tierUtils.js           # resolveBoard: доска + библиотека → ранги и пул
    ├── sync/
    │   ├── gist.js                # клиент GitHub Gist API (поиск, чтение, запись)
    │   ├── merge.js               # слияние данных и настроек, tombstones, канонический вид
    │   └── SyncProvider.jsx       # движок синхронизации: когда и что отправлять
    ├── hooks/
    │   ├── useMediaSearch.js      # дебаунс + отмена + кэш запросов
    │   └── usePersistentState.js  # UI-настройки (фильтры, сортировка) в localStorage
    ├── utils/
    │   ├── helpers.js             # id, плюрализация, цвета, скачивание файлов
    │   └── exportRatings.js       # экспорт оценок: CSV и текстовый список
    └── components/
        ├── Header.jsx             # лого, вкладки, поиск, экспорт/импорт/настройки
        ├── SettingsModal.jsx      # синхронизация, API-ключи, язык, бэкап, очистка
        ├── SyncIndicator.jsx      # значок состояния синхронизации в шапке
        ├── Backup.jsx             # useBackup(): экспорт JSON, диалог импорта
        ├── ItemEditor.jsx         # добавление (из поиска и вручную) и редактирование
        ├── search/SearchBar.jsx   # автокомплит с клавиатурной навигацией
        ├── library/
        │   ├── Library.jsx        # фильтры, сортировка, сетка
        │   └── LibraryCard.jsx    # постер + быстрые правки статуса и оценки
        ├── tierlist/
        │   ├── TierListPage.jsx   # выбор/создание/параметры досок
        │   ├── TierBoard.jsx      # DndContext, логика multiple containers, экспорт PNG
        │   ├── TierRow.jsx        # ранг и пул (droppable + SortableContext)
        │   ├── TierCard.jsx       # карточка + sortable-обёртка
        │   └── TierEditor.jsx     # название/цвет ранга, очистка, удаление
        └── ui/
            ├── Modal.jsx          # портал, стек Escape, блокировка скролла
            ├── Toast.jsx          # уведомления
            └── primitives.jsx     # Button, Select, Poster, TypeBadge, RatingPicker…
```

---

## 3. Модель данных

Запись библиотеки (ключ `mediavault:data:v1` в localStorage):
```json
{
  "uid": "movie:693134",
  "id": 693134,
  "media_type": "movie",
  "title": "Дюна: Часть вторая",
  "original_title": "Dune: Part Two",
  "poster_path": "https://image.tmdb.org/t/p/w342/....jpg",
  "year": 2024,
  "user_rating": 9,
  "status": "Completed",
  "notes": "IMAX того стоил",
  "added_at": 1731000000000,
  "updated_at": 1731000000000,
  "meta": {}
}
```
- `media_type`: `movie` | `tv` | `game` | `anime`
- `status`: `Planned` | `Watching/Playing` | `Completed` | `Dropped`
- `uid = media_type:id`: у TMDB фильм и сериал могут иметь одинаковый числовой `id`
- `poster_path` хранит полный URL, потому что у трёх источников разные CDN
- `meta`: `platforms` для игр, `format`/`episodes` для аниме

Тир-лист:
```json
{
  "id": "uuid",
  "name": "Игры 2025",
  "filter": { "mediaType": "game", "status": "Completed" },
  "showTitles": false,
  "tiers": [{ "id": "uuid", "label": "S", "color": "#ff7f7f", "items": ["game:3498"] }],
  "unranked": ["game:4200"]
}
```
Пул «Нераспределённое» вычисляется на лету: туда попадают все тайтлы библиотеки, подходящие под фильтр и не стоящие в ранге. Новые тайтлы оказываются в пуле автоматически.

Бэкап (`mediavault-backup-YYYY-MM-DD.json`) содержит `{ app, version, exported_at, library, tierLists, activeTierListId, settings }`. API-ключи попадают в файл только с галочкой в настройках. При импорте каждая запись проверяется; битые записи пропускаются.

---

## 4. Технические решения

**dnd-kit вместо @hello-pangea/dnd.** `@hello-pangea/dnd` не поддерживает списки с переносом строк (grid/wrap), а в тир-листе ряды постеров переносятся всегда. dnd-kit с `rectSortingStrategy` корректно работает с такой раскладкой, поддерживает тач (долгое нажатие) и клавиатуру. Логика повторяет официальный пример *multiple containers*: во время перетаскивания состояние живёт локально, в стор и localStorage коммитится один раз в `onDragEnd`.

**html2canvas-pro вместо html2canvas.** Tailwind v4 задаёт палитру через `oklch()`. Оригинальный `html2canvas@1.4.1` (не обновлялся с 2022 года) на таких цветах падает с ошибкой *unsupported color function "oklch"*. `html2canvas-pro` — форк с тем же API, который это поддерживает. Библиотека подгружается лениво при первом экспорте.

**CORS постеров.** Все `<img>` грузятся с `crossOrigin="anonymous"`. CDN TMDB, RAWG и AniList отдают `Access-Control-Allow-Origin`, поэтому canvas не становится tainted и PNG сохраняется. Если в HTTP-кэше браузера уже лежит ответ без CORS-заголовков, `Poster` один раз повторяет загрузку с `?cors=1`, то есть в обход кэша. Постеры нельзя подключать через CSS `background-image`: такие запросы идут без CORS и «отравляют» кэш.

**Хеш-роутинг.** `#/library` и `#/tiers` не требуют хака с `404.html` на GitHub Pages.

## 5. Ограничения

- `localStorage` вмещает ~5 МБ, этого хватает на тысячи тайтлов. Данные привязаны к браузеру и домену, поэтому делайте экспорт.
- У AniList лимит ~30–90 запросов в минуту. Поиск дебаунсится (400 мс) и кэшируется.
- Википедия: обложки есть почти у всех известных игр, но не у всех; у части статей нет года в описании. Недостающее можно поправить вручную в карточке («Исправить название, год или постер»). Платформ в Википедии нет.
- У RAWG обложки горизонтальные, в карточке 2:3 они обрезаются по центру.
- Блокировщики рекламы иногда режут `api.themoviedb.org`. Если поиск пишет «сеть недоступна», проверьте их.
