import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../public/js/schema.js';
import { backupFileName, makeBackup, readBackup } from '../public/js/backup.js';
import * as store from '../public/js/store.js';
import { sampleImport } from './sample.mjs';

const memStorage = () => {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
};
const reason = (fn) => {
  try {
    fn();
  } catch (e) {
    return e.code;
  }
  return null;
};
const dataWith = (n) => {
  const d = emptyData();
  for (let i = 0; i < n; i++) d.rounds.push({ id: `r${i}`, date: '2026-01-01', courseId: 'c', holeCount: 18, companionIds: [], holes: [] });
  return d;
};

test('バックアップのファイル名は日付と時刻つき', () => {
  assert.equal(backupFileName(new Date(2026, 10, 14, 9, 5)), 'golfscore-backup-20261114-0905.json');
});

test('書き出したバックアップを読み戻せる', () => {
  const d = dataWith(2);
  const { text } = makeBackup(d, new Date('2026-11-14T04:30:00Z'));
  const b = readBackup(text);
  assert.deepEqual(b.data, d);
  assert.equal(b.rounds, 2);
  assert.equal(b.createdAt, '2026-11-14T04:30:00.000Z');
  assert.equal(JSON.parse(text).type, 'golf-backup');
});

test('読めないファイルは理由つきで拒否する', () => {
  assert.equal(reason(() => readBackup('こんにちは')), 'format');
  assert.equal(reason(() => readBackup('{"type":"x"}')), 'format');
  assert.equal(reason(() => readBackup(JSON.stringify(sampleImport()))), 'import');
  assert.equal(reason(() => readBackup(JSON.stringify({ type: 'golf-backup', schema: 9, data: { schema: 9 } }))), 'newer');
  assert.equal(reason(() => readBackup(JSON.stringify({ type: 'golf-backup', schema: 1, data: { schema: 9 } }))), 'newer');
  assert.equal(reason(() => readBackup(JSON.stringify({ type: 'golf-backup', schema: 1 }))), 'format');
});

test('復元すると前のデータを控えに残し、取り消すと元に戻る', () => {
  const s = memStorage();
  globalThis.localStorage = s;
  store.init(s);
  store.update((st) => st.companions.push({ id: 'a', name: '田中' }), s);
  const before = s.getItem('golf.data');
  assert.equal(store.hasRollback(s), false);

  store.restore(dataWith(3), s);
  assert.equal(store.getState().rounds.length, 3);
  assert.equal(store.getState().companions.length, 0);
  assert.equal(store.hasRollback(s), true);

  store.undoRestore(s);
  assert.equal(s.getItem('golf.data'), before);
  assert.equal(store.getState().companions.length, 1);
  assert.equal(store.hasRollback(s), false);
  assert.equal(reason(() => store.undoRestore(s)), 'norollback');
});

test('初めての端末で復元して取り消すと、空の状態に戻る', () => {
  const s = memStorage();
  store.init(s);
  store.restore(dataWith(1), s);
  store.undoRestore(s);
  assert.equal(s.getItem('golf.data'), null);
  assert.equal(store.getState().rounds.length, 0);
});

test('読めない保存データがあっても復元でき、取り消せばそのままの文字に戻る', () => {
  const s = memStorage();
  s.setItem('golf.data', '{壊れたデータ');
  store.init(s);
  assert.ok(store.getBlocked());
  store.restore(dataWith(1), s);
  assert.equal(store.getBlocked(), null);
  store.undoRestore(s);
  assert.equal(s.getItem('golf.data'), '{壊れたデータ');
  assert.ok(store.getBlocked());
});

test('復元の保存に失敗したら、元のデータのまま', () => {
  const s = memStorage();
  store.init(s);
  store.update((st) => st.companions.push({ id: 'a', name: '田中' }), s);
  const full = { ...s, setItem: () => { throw new Error('quota'); } };
  assert.equal(reason(() => store.restore(dataWith(3), full)), 'save');
  assert.equal(store.getState().companions.length, 1);
});

test('バックアップが古いかの判定', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.parse('2026-11-14T00:00:00Z');
  assert.equal(store.backupStale(dataWith(0), {}, now), false); // ラウンドがなければ出さない
  assert.equal(store.backupStale(dataWith(1), {}, now), true); // 一度もしていない
  assert.equal(store.backupStale(dataWith(1), { lastBackupAt: new Date(now - 6 * day).toISOString() }, now), false);
  assert.equal(store.backupStale(dataWith(1), { lastBackupAt: new Date(now - 7 * day).toISOString() }, now), true);
});

test('設定は別のキーに保存され、壊れていても起動できる', () => {
  const s = memStorage();
  store.init(s);
  store.updateSettings({ lastBackupAt: '2026-11-14T00:00:00.000Z' }, s);
  assert.equal(JSON.parse(s.getItem('golf.settings')).lastBackupAt, '2026-11-14T00:00:00.000Z');
  s.setItem('golf.settings', '{壊れ');
  store.init(s);
  assert.deepEqual(store.getSettings(), {});
});
