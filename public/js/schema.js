// データ形式の版。古い版は読み込むたびにメモリ上で最新へ読み替える。
import { isNum, clone } from './util.js';

export const SCHEMA = 1;

export class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function emptyData() {
  return { schema: SCHEMA, courses: [], companions: [], rounds: [] };
}

// 版を上げたら、ここに「n → n+1」の読み替えを足す。
const DATA_STEPS = {};
const IMPORT_STEPS = {};

function upgrade(obj, steps) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new AppError('format', '形式が正しくありません');
  }
  if (!isNum(obj.schema)) throw new AppError('noschema', '版番号がありません');
  if (obj.schema > SCHEMA) {
    throw new AppError('newer', 'このデータは新しい版で作られています。アプリを更新してください。');
  }
  let cur = clone(obj);
  while (cur.schema < SCHEMA) {
    const step = steps[cur.schema];
    if (!step) throw new AppError('format', '形式が正しくありません');
    cur = step(cur);
  }
  return cur;
}

/** 端末内データ・バックアップの中身を最新の版にする。 */
export function migrateData(obj) {
  const d = upgrade(obj, DATA_STEPS);
  for (const k of ['courses', 'companions', 'rounds']) {
    if (!Array.isArray(d[k])) d[k] = [];
  }
  return d;
}

/** 取り込みデータを最新の版にする。 */
export function migrateImport(obj) {
  return upgrade(obj, IMPORT_STEPS);
}
