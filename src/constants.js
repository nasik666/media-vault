import { Film, Gamepad2, Sparkles, Tv } from 'lucide-react';

/** Типы медиа. Ключ = media_type, который хранится в библиотеке. */
export const MEDIA_TYPES = {
  movie: {
    label: 'Фильм',
    plural: 'Фильмы',
    icon: Film,
    text: 'text-sky-300',
    soft: 'bg-sky-500/15 ring-sky-500/30',
  },
  tv: {
    label: 'Сериал',
    plural: 'Сериалы',
    icon: Tv,
    text: 'text-emerald-300',
    soft: 'bg-emerald-500/15 ring-emerald-500/30',
  },
  game: {
    label: 'Игра',
    plural: 'Игры',
    icon: Gamepad2,
    text: 'text-amber-300',
    soft: 'bg-amber-500/15 ring-amber-500/30',
  },
  anime: {
    label: 'Аниме',
    plural: 'Аниме',
    icon: Sparkles,
    text: 'text-pink-300',
    soft: 'bg-pink-500/15 ring-pink-500/30',
  },
};

export const MEDIA_TYPE_KEYS = Object.keys(MEDIA_TYPES);

/** Значения статусов хранятся ровно в таком виде (это часть формата бэкапа). */
export const STATUSES = ['Planned', 'Watching/Playing', 'Completed', 'Dropped'];

const STATUS_META = {
  Planned: { label: 'В планах', generic: 'В планах', dot: 'bg-zinc-400' },
  'Watching/Playing': { label: 'Смотрю', game: 'Играю', generic: 'Смотрю / играю', dot: 'bg-sky-400' },
  Completed: { label: 'Просмотрено', game: 'Пройдено', generic: 'Просмотрено / пройдено', dot: 'bg-emerald-400' },
  Dropped: { label: 'Брошено', generic: 'Брошено', dot: 'bg-rose-400' },
};

/** Подпись статуса. Без mediaType — нейтральная («В процессе»), для игр — «Играю/Пройдено». */
export function statusLabel(status, mediaType) {
  const meta = STATUS_META[status];
  if (!meta) return status;
  if (!mediaType) return meta.generic;
  if (mediaType === 'game' && meta.game) return meta.game;
  return meta.label;
}

/** Тир-листы по умолчанию ранжируют то, что вы уже смотрите/прошли, — без «В планах» и «Брошено». */
export const DEFAULT_BOARD_STATUSES = ['Watching/Playing', 'Completed'];

export function statusDot(status) {
  return STATUS_META[status]?.dot ?? 'bg-zinc-500';
}

export const ANIME_FORMATS = {
  TV: 'TV',
  TV_SHORT: 'TV Short',
  MOVIE: 'Movie',
  SPECIAL: 'Special',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Music',
};

export const SORT_OPTIONS = [
  { value: 'added_desc', label: 'Сначала новые' },
  { value: 'added_asc', label: 'Сначала старые' },
  { value: 'rating_desc', label: 'Оценка ↓' },
  { value: 'rating_asc', label: 'Оценка ↑' },
  { value: 'title_asc', label: 'Название А→Я' },
  { value: 'title_desc', label: 'Название Я→А' },
  { value: 'year_desc', label: 'Год выхода ↓' },
];

/** Классические цвета тир-листа. */
export const DEFAULT_TIERS = [
  { label: 'S', color: '#ff7f7f' },
  { label: 'A', color: '#ffbf7f' },
  { label: 'B', color: '#ffdf7f' },
  { label: 'C', color: '#bfff7f' },
  { label: 'D', color: '#7fbfff' },
];

export const TIER_COLOR_PRESETS = [
  '#ff7f7f',
  '#ffbf7f',
  '#ffdf7f',
  '#ffff7f',
  '#bfff7f',
  '#7fff7f',
  '#7fffff',
  '#7fbfff',
  '#7f7fff',
  '#ff7fff',
  '#bf7fbf',
  '#a1a1aa',
  '#3f3f46',
];

export const SEARCH_CATEGORIES = [
  { value: 'all', label: 'Все' },
  { value: 'movie', label: 'Фильмы' },
  { value: 'tv', label: 'Сериалы' },
  { value: 'game', label: 'Игры' },
  { value: 'anime', label: 'Аниме' },
];
