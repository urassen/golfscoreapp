// 端末内の保存(localStorage)。メモリ上に state を1つ持ち、変更のたびに書く。
import { AppError, emptyData, migrateData } from './schema.js';
import { clone } from './util.js';

export const KEYS = { data: 'golf.data', rollback: 'golf.rollback', settings: 'golf.settings' };

let state = emptyData();
let blocked = null; // 保存データを読めなかったときの理由。入っている間は上書きしない(復元だけはできる)。
let settings = {};

/** 起動時に1回呼ぶ。保存データを読み、古い版はメモリ上で最新へ読み替える。 */
export function init(storage = globalThis.localStorage) {
  blocked = null;
  state = emptyData();
  settings = {};
  try {
    const rs = storage.getItem(KEYS.settings);
    const o = rs ? JSON.parse(rs) : null;
    if (o && typeof o === 'object' && !Array.isArray(o)) settings = o;
  } catch {
    settings = {};
  }
  let raw = null;
  try {
    raw = storage.getItem(KEYS.data);
  } catch {
    blocked = '端末内の保存領域を使えません。ブラウザの設定を確認してください。';
    return;
  }
  if (raw == null) return;
  try {
    state = migrateData(JSON.parse(raw));
  } catch (e) {
    blocked =
      e instanceof AppError && e.code === 'newer'
        ? '保存されているデータは新しい版で作られています。アプリを更新してください。'
        : '保存されているデータを読めませんでした。';
  }
}

export const getState = () => state;
export const getBlocked = () => blocked;

/**
 * state を変更して保存する。fn には state のコピーが渡る。
 * 保存に失敗したときは AppError('save') を投げ、state は元のまま。
 */
export function update(fn, storage = globalThis.localStorage) {
  if (blocked) throw new AppError('blocked', blocked);
  const next = clone(state);
  const result = fn(next);
  try {
    storage.setItem(KEYS.data, JSON.stringify(next));
  } catch {
    throw new AppError('save', '保存できませんでした。端末の空き容量を確認して、やり直してください。');
  }
  state = next;
  return result;
}

export const getSettings = () => settings;

/** 設定を書き換えて保存する。失敗したら AppError('save') を投げ、設定は元のまま。 */
export function updateSettings(patch, storage = globalThis.localStorage) {
  const next = { ...settings, ...patch };
  try {
    storage.setItem(KEYS.settings, JSON.stringify(next));
  } catch {
    throw new AppError('save', '保存できませんでした。端末の空き容量を確認して、やり直してください。');
  }
  settings = next;
}

/**
 * 復元: 今の保存データ(読めないものも、そのままの文字で)を控えに退避してから、data に置き換える。
 * data は migrateData を通した最新の版。
 */
export function restore(data, storage = globalThis.localStorage) {
  let current = null;
  try {
    current = storage.getItem(KEYS.data);
  } catch {
    current = null;
  }
  const err = () => new AppError('save', '保存できませんでした。端末の空き容量を確認して、やり直してください。');
  try {
    storage.setItem(KEYS.rollback, JSON.stringify({ at: new Date().toISOString(), raw: current }));
  } catch {
    throw err();
  }
  try {
    storage.setItem(KEYS.data, JSON.stringify(data));
  } catch {
    throw err();
  }
  state = clone(data);
  blocked = null;
}

export function hasRollback(storage = globalThis.localStorage) {
  try {
    return storage.getItem(KEYS.rollback) != null;
  } catch {
    return false;
  }
}

/** 復元を取り消す: 控えの内容に戻し、控えを消す。 */
export function undoRestore(storage = globalThis.localStorage) {
  let saved = null;
  try {
    saved = JSON.parse(storage.getItem(KEYS.rollback));
  } catch {
    saved = null;
  }
  if (!saved || typeof saved !== 'object') throw new AppError('norollback', '取り消せる復元がありません。');
  try {
    if (saved.raw == null) storage.removeItem(KEYS.data);
    else storage.setItem(KEYS.data, saved.raw);
    storage.removeItem(KEYS.rollback);
  } catch {
    throw new AppError('save', '保存できませんでした。端末の空き容量を確認して、やり直してください。');
  }
  init(storage);
}

/** バックアップが古いか。ラウンドがあり、最後のバックアップがないか7日以上前のとき。 */
export function backupStale(st = state, set = settings, now = Date.now()) {
  if (!st.rounds.length) return false;
  const last = Date.parse(set.lastBackupAt || '');
  if (!Number.isFinite(last)) return true;
  return now - last >= 7 * 24 * 60 * 60 * 1000;
}

export function courseUsed(st, courseId) {
  return st.rounds.some((r) => r.courseId === courseId);
}
export function companionCount(st, companionId) {
  return st.rounds.filter((r) => r.companionIds.includes(companionId)).length;
}
