// 端末内の保存(localStorage)。メモリ上に state を1つ持ち、変更のたびに書く。
import { AppError, emptyData, migrateData } from './schema.js';
import { clone } from './util.js';

export const KEYS = { data: 'golf.data', rollback: 'golf.rollback', settings: 'golf.settings' };

let state = emptyData();
let blocked = null; // 保存データを読めなかったときの理由。入っている間は上書きしない。

/** 起動時に1回呼ぶ。保存データを読み、古い版はメモリ上で最新へ読み替える。 */
export function init(storage = globalThis.localStorage) {
  blocked = null;
  state = emptyData();
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

export function courseUsed(st, courseId) {
  return st.rounds.some((r) => r.courseId === courseId);
}
export function companionCount(st, companionId) {
  return st.rounds.filter((r) => r.companionIds.includes(companionId)).length;
}
