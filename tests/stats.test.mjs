import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, migrateData } from '../public/js/schema.js';
import { parseImport, prepareDraft, register } from '../public/js/importer.js';
import { filterRounds, rateText, summarize } from '../public/js/stats.js';
import * as store from '../public/js/store.js';
import { sampleImport, TOTAL_ME, TOTAL_PUTT } from './sample.mjs';

function add(st, over = {}, edit) {
  const o = sampleImport(over);
  if (edit) edit(o);
  const d = prepareDraft(st, parseImport(JSON.stringify(o)));
  d.allHoles.forEach((h) => (h.check = []));
  d.totalAck = true;
  d.dupChoice = 'add';
  return register(st, d);
}

test('統計: 平均・ベスト・パット・パー別・内訳・率', () => {
  const st = emptyData();
  add(st);
  const s = summarize(filterRounds(st, { holeCount: 18, courseId: '', period: '10' }));
  assert.equal(s.count, 1);
  assert.equal(s.avg, TOTAL_ME);
  assert.equal(s.best, TOTAL_ME);
  assert.equal(s.puttAvg, TOTAL_PUTT);
  assert.equal(s.threePutts, 2);
  // パー3: 4,3,4,4 → 3.75 / パー5: 6,7,6,6 → 6.25
  assert.equal(s.parAvg[3], 3.75);
  assert.equal(s.parAvg[5], 6.25);
  assert.equal(s.breakdown.n, 18);
  assert.equal(s.breakdown.parOrBetter + s.breakdown.bogey + s.breakdown.double, 18);
  assert.equal(s.breakdown.parOrBetter, 2); // 6番(パー3を3)と13番(パー4を4)
  assert.equal(s.breakdown.double, 3); // 5番・8番・14番
  assert.equal(s.fw.n, 14); // パー4・5は14ホール
  assert.equal(s.gir.n, 18);
  assert.equal(s.lines[0].bunker, 1);
  assert.equal(s.lines[0].ob, 1);
});

test('統計: パーオンの推定は 打数−パット数 が パー−2 以下(罰打は引かない)', () => {
  const st = emptyData();
  add(st, {}, (o) => {
    o.holes[0].strokes.p1 = 4; // パー4を4打・2パット → 2打で乗った → パーオン
    o.holes[0].self.putt = 2;
    o.holes[1].strokes.p1 = 3; // パー3を3打・2パット → 1打で乗った → パーオン
    o.holes[1].self.putt = 2;
    o.holes[2].strokes.p1 = 6; // パー5を6打・2パット・ペナルティ1 → 4打で乗った → パーオンではない
    o.holes[2].self.putt = 2;
    o.holes[2].self.penalty = 1;
  });
  const s = summarize(st.rounds);
  assert.equal(s.gir.hit, 2); // 見本データのほかのホールは、どれもパーオンではない
  assert.equal(s.gir.n, 18);
});

test('統計: 話し忘れたホールは分母から除き、パット不明のラウンドは積み上げない', () => {
  const st = emptyData();
  add(st, {}, (o) => {
    o.holes[0].self.putt = null;
    o.holes[0].self.direction = null;
  });
  const s = summarize(st.rounds);
  assert.equal(s.lines[0].putts, null);
  assert.equal(s.puttAvg, null);
  assert.equal(s.gir.n, 17);
  assert.equal(s.fw.n, 13);
  assert.equal(rateText(45, 72), '62%(45/72ホール)'.replace('62', String(Math.round((45 / 72) * 100))));
  assert.equal(rateText(0, 0), '-');
});

test('絞り込み: ホール数・コース・直近N回・年', () => {
  const st = emptyData();
  add(st, { date: '2025-12-01' });
  add(st, { date: '2026-01-10' });
  add(st, { date: '2026-02-10', course: { facility: '別のコース', nines: [] } });
  const all = { holeCount: 18, courseId: '', period: 'all' };
  assert.equal(filterRounds(st, all).length, 3);
  assert.equal(filterRounds(st, { ...all, holeCount: 9 }).length, 0);
  assert.equal(filterRounds(st, { ...all, period: 'y2026' }).length, 2);
  assert.equal(filterRounds(st, { ...all, courseId: st.courses[0].id }).length, 2);
  const two = filterRounds(st, { ...all, period: '5' }).slice(0, 2);
  assert.deepEqual(two.map((r) => r.date), ['2026-02-10', '2026-01-10']); // 新しい順
  const s = summarize(filterRounds(st, all));
  assert.deepEqual(s.lines.map((l) => l.date), ['2025-12-01', '2026-01-10', '2026-02-10']); // グラフは古い順
});

test('版: 新しい版のデータは拒否し、同じ版はそのまま読む', () => {
  assert.throws(() => migrateData({ schema: 2 }), (e) => e.code === 'newer');
  assert.throws(() => migrateData({}), (e) => e.code === 'noschema');
  assert.throws(() => migrateData(null), (e) => e.code === 'format');
  assert.deepEqual(migrateData({ schema: 1 }), emptyData());
});

test('保存: 失敗したら元のデータのまま。読めない保存データは上書きしない', () => {
  const mem = new Map();
  const ok = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
  const full = { getItem: ok.getItem, setItem: () => { throw new Error('quota'); } };
  globalThis.localStorage = ok;
  store.init();
  store.update((s) => s.companions.push({ id: 'a', name: '田中' }));
  assert.equal(JSON.parse(mem.get('golf.data')).companions.length, 1);
  assert.throws(() => store.update((s) => s.companions.push({ id: 'b', name: '佐藤' }), full), (e) => e.code === 'save');
  assert.equal(store.getState().companions.length, 1);

  mem.set('golf.data', JSON.stringify({ schema: 99, rounds: [] }));
  store.init();
  assert.ok(store.getBlocked());
  assert.throws(() => store.update(() => {}), (e) => e.code === 'blocked');
  assert.equal(JSON.parse(mem.get('golf.data')).schema, 99);
});
