import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../public/js/schema.js';
import { batchDuplicateOf, issues, parseImportAll, prepareDraft, registerBatch } from '../public/js/importer.js';
import { filterHistory } from '../public/js/stats.js';
import { sampleImport } from './sample.mjs';

const round = (over = {}, edit) => {
  const o = sampleImport(over);
  delete o.type;
  delete o.schema;
  o.holes.forEach((h) => (h.check = []));
  if (edit) edit(o);
  return o;
};
const batchText = (rounds) => JSON.stringify({ type: 'golf-rounds', schema: 1, rounds });
const load = (st, text) => {
  const items = parseImportAll(text);
  items.forEach((it) => it.draft && prepareDraft(st, it.draft));
  return items;
};

test('まとめ取り込み: 複数ラウンドを読み、読めないラウンドだけをエラーにする', () => {
  const items = parseImportAll(batchText([round({ date: '2026-04-01' }), { date: 'x' }, round({ date: '2026-04-15' })]));
  assert.equal(items.length, 3);
  assert.ok(items[0].draft && items[2].draft);
  assert.equal(items[1].error, '日付がありません');
  assert.equal(items[2].draft.date, '2026-04-15');
});

test('まとめ取り込み: 全体が読めないときは理由つきで拒否する', () => {
  const code = (t) => {
    try {
      parseImportAll(t);
    } catch (e) {
      return e.code;
    }
    return null;
  };
  assert.equal(code('こんにちは'), 'format');
  assert.equal(code(batchText([])), 'rounds');
  assert.equal(code(JSON.stringify({ type: 'golf-rounds', schema: 2, rounds: [round()] })), 'newer');
  assert.equal(code(JSON.stringify({ type: 'golf-rounds', rounds: [round()] })), 'noschema');
});

test('1ラウンドの形(golf-round)も、これまでどおり読める', () => {
  const items = parseImportAll(JSON.stringify(sampleImport()));
  assert.equal(items.length, 1);
  assert.ok(items[0].draft);
});

test('まとめて登録: 新しいコース・同伴者は1回だけ登録し、要確認のあるラウンドは残す', () => {
  const st = emptyData();
  const items = load(
    st,
    batchText([
      round({ date: '2026-04-01' }),
      round({ date: '2026-04-15' }),
      round({ date: '2026-05-01' }, (o) => (o.holes[0].check = ['strokes.p1'])),
    ])
  );
  const done = registerBatch(st, items);
  assert.deepEqual(done, [0, 1]);
  assert.equal(st.rounds.length, 2);
  assert.equal(st.courses.length, 1);
  assert.equal(st.companions.length, 1);
  assert.equal(st.rounds[0].courseId, st.rounds[1].courseId);
  assert.deepEqual(st.rounds[0].companionIds, st.rounds[1].companionIds);
  // 下書きは書き換えない(残ったラウンドは、あとで直して登録できる)
  assert.equal(items[1].draft.courseSel, 'new');
});

test('まとめて登録: 取り込みの中の同じラウンドは後のほうを飛ばす。登録済みと同じラウンドは選ぶまで飛ばす', () => {
  const st = emptyData();
  const first = load(st, batchText([round({ date: '2026-04-01' })]));
  registerBatch(st, first);

  const items = load(st, batchText([round({ date: '2026-04-01' }), round({ date: '2026-06-01' }), round({ date: '2026-06-01' })]));
  assert.equal(batchDuplicateOf(items, 2), 1);
  assert.ok(issues(st, items[0].draft).dup);
  const done = registerBatch(st, items);
  assert.deepEqual(done, [1]);
  assert.equal(st.rounds.length, 2);

  items[0].draft.dupChoice = 'add';
  assert.deepEqual(registerBatch(st, [items[0]]), [0]);
  assert.equal(st.rounds.length, 3);
});

test('まとめて登録: 同じ新しいコースでパーが違うラウンドは、コースの違いとして残す', () => {
  const st = emptyData();
  const items = load(st, batchText([round({ date: '2026-04-01' }), round({ date: '2026-04-15' }, (o) => (o.holes[0].par = 5))]));
  assert.deepEqual(registerBatch(st, items), [0]);
  assert.equal(st.courses.length, 1);
});

test('履歴の絞り込み: 選んだ同伴者全員を含むラウンドと、年', () => {
  const st = emptyData();
  const mk = (id, date, companionIds) => ({ id, date, courseId: 'c', holeCount: 18, companionIds, holes: [] });
  st.rounds.push(mk('a', '2025-10-01', ['k', 's']), mk('b', '2026-03-29', ['k', 's', 'o']), mk('c', '2026-05-01', ['k']), mk('d', '2026-06-01', []));
  const ids = (rs) => rs.map((r) => r.id);
  assert.deepEqual(ids(filterHistory(st, {})), ['d', 'c', 'b', 'a']);
  assert.deepEqual(ids(filterHistory(st, { companionIds: ['k'] })), ['c', 'b', 'a']);
  assert.deepEqual(ids(filterHistory(st, { companionIds: ['k', 's'] })), ['b', 'a']);
  assert.deepEqual(ids(filterHistory(st, { companionIds: ['k', 's'], year: '2026' })), ['b']);
  assert.deepEqual(ids(filterHistory(st, { companionIds: ['o', 'x'] })), []);
});
