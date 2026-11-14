// バックアップのファイルの作成と読み取り。画面にも保存にも依存しない。
import { AppError, SCHEMA, migrateData } from './schema.js';
import { APP_VERSION } from './util.js';

const pad = (n) => String(n).padStart(2, '0');

/** ファイル名は golfscore-backup-YYYYMMDD-HHMM.json(端末の時刻)。 */
export function backupFileName(d = new Date()) {
  return `golfscore-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

export function makeBackup(data, d = new Date()) {
  const body = { type: 'golf-backup', schema: SCHEMA, createdAt: d.toISOString(), appVersion: APP_VERSION, data };
  return { name: backupFileName(d), text: JSON.stringify(body) };
}

/**
 * バックアップのファイルの文字を読み、最新の版のデータと、作成日時・ラウンド数を返す。
 * 読めないときは AppError を投げる(message は画面にそのまま出せる文)。
 */
export function readBackup(text) {
  let o;
  try {
    o = JSON.parse(String(text ?? ''));
  } catch {
    throw new AppError('format', 'このファイルはバックアップとして読めません。');
  }
  if (o && o.type === 'golf-round') {
    throw new AppError('import', 'これは取り込み用のデータです。取り込み画面に貼り付けてください。');
  }
  if (!o || o.type !== 'golf-backup' || !o.data || typeof o.data !== 'object') {
    throw new AppError('format', 'このファイルはバックアップとして読めません。');
  }
  if (typeof o.schema === 'number' && o.schema > SCHEMA) {
    throw new AppError('newer', 'このファイルは新しい版で作られています。アプリを更新してください。');
  }
  let data;
  try {
    data = migrateData(o.data);
  } catch (e) {
    if (e && e.code === 'newer') {
      throw new AppError('newer', 'このファイルは新しい版で作られています。アプリを更新してください。');
    }
    throw new AppError('format', 'このファイルはバックアップとして読めません。');
  }
  return { data, createdAt: typeof o.createdAt === 'string' ? o.createdAt : null, rounds: data.rounds.length };
}
