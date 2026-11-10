// 共通の小さな関数。画面にも保存にも依存しない。

export const APP_VERSION = '0.1.1';

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

export const CLUBS = ['1W', '3W', '5W', 'U3', 'U4', '5i', '6i', '7i', '8i', '9i', 'PW', 'AW', 'SW', 'PT'];
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
