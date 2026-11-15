// 共通の小さな関数。画面にも保存にも依存しない。

export const APP_VERSION = '0.3.0';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** 画面に出す文字列は必ずこれを通す。 */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

export function uid() {
  const c = globalThis.crypto;
  if (c && c.randomUUID) return c.randomUUID().replace(/-/g, '').slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

/** 名前の照合用。空白・全角半角・大文字小文字を無視する(記号は残す)。 */
export function normName(s) {
  return String(s ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
export const sum = (a) => a.reduce((x, y) => x + y, 0);
export const fmtDate = (d) => (d ? String(d).replace(/-/g, '/') : '');
export const clone = (o) => JSON.parse(JSON.stringify(o));

/** クラブ管理の初めの状態(版0.2.0までの固定の14種類)。 */
export const DEFAULT_CLUBS = ['1W', '3W', '5W', 'U3', 'U4', '5i', '6i', '7i', '8i', '9i', 'PW', 'AW', 'SW', 'PT'];

/** クラブ管理の候補(この順に並べる)。 */
export const CLUB_CANDIDATES = [
  '1W', '2W', '3W', '4W', '5W', '6W', '7W', '8W', '9W',
  'U2', 'U3', 'U4', 'U5', 'U6', 'U7',
  '3i', '4i', '5i', '6i', '7i', '8i', '9i',
  'PW', 'AW', 'GW', 'SW', 'LW', 'PT',
];

/** クラブの照合用。全角半角・大文字小文字・空白を無視する。 */
export function normClub(s) {
  return String(s ?? '').normalize('NFKC').replace(/\s+/g, '').toUpperCase();
}

/** 登録済みのクラブの中から、同じクラブの表記を探す。なければ null。 */
export function findClub(clubs, name) {
  const n = normClub(name);
  return (clubs || []).find((c) => normClub(c) === n) ?? null;
}

/** 候補の順に並べ、候補にない名前は後ろ(足した順)。 */
export function sortClubs(list) {
  const idx = (c) => {
    const i = CLUB_CANDIDATES.findIndex((x) => normClub(x) === normClub(c));
    return i < 0 ? CLUB_CANDIDATES.length : i;
  };
  return list
    .map((c, i) => ({ c, i }))
    .sort((a, b) => idx(a.c) - idx(b.c) || a.i - b.i)
    .map((x) => x.c);
}
export const DIR_PAR45 = ['keep', 'left', 'right'];
export const DIR_PAR3 = ['over', 'left', 'oneon', 'right', 'short'];
const DIR_LABEL45 = { keep: 'FWキープ', left: 'FW左', right: 'FW右' };
const DIR_LABEL3 = { over: 'オーバー', left: '左', oneon: 'ワンオン', right: '右', short: 'ショート' };

export function dirChoices(par) {
  return par === 3 ? DIR_PAR3 : DIR_PAR45;
}
export function dirLabel(par, dir) {
  if (!dir) return '';
  return (par === 3 ? DIR_LABEL3 : DIR_LABEL45)[dir] ?? '';
}
export function dirValid(par, dir) {
  return dir == null || dirChoices(par).includes(dir);
}

/** コースの表示名。「施設名(前半→後半)」。名称がなければ施設名だけ。 */
export function courseLabel(c) {
  if (!c) return '(不明なコース)';
  const n = (c.nines || []).map((x) => x || '').filter((x) => x !== '');
  return n.length ? `${c.facility}(${n.join('→')})` : c.facility;
}

/** 前半・後半の見出し。「前半 笠置」。名称がなければ「前半」。 */
export function halfLabel(nines, idx) {
  const base = idx === 0 ? '前半' : '後半';
  const n = (nines || [])[idx];
  return n ? `${base} ${n}` : base;
}

/** 日時の表示。「2026/11/14 13:30」(端末の時刻)。読めなければ空。 */
export function fmtDateTime(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
