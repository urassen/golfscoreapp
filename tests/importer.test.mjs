import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../public/js/schema.js';
import { draftHoles, issues, matchCompanion, matchCourse, parseImport, prepareDraft, register, fixCourse } from '../public/js/importer.js';
import { sampleImport, TOTAL_ME } from './sample.mjs';

const text = (o) => JSON.stringify(o);
const clearChecks = (d) => d.allHoles.forEach((h) => (h.check = []));
const reason = (fn) => {
  try {
    fn();
  } catch (e) {
    return e.code;
  }
  return null;
};

test('取り込みデータを読める(前後の説明文や```があってもよい)', () => {
  const d = parseImport('こちらです。\n```json\n' + text(sampleImport()) + '\n```\n以上です。');
  assert.equal(d.date, '2026-03-29');
  assert.equal(d.holeCount, 18);
  assert.deepEqual(d.nines, ['笠置', '木津川']);
  assert.equal(d.players[0].key, 'self');
  assert.equal(d.allHoles[9].no, 1); // 後半も印刷どおり1番から
  assert.deepEqual(d.allHoles[2].check.sort(), ['club', 's:self']);
  assert.equal(d.printedTotals.self, TOTAL_ME);
});

test('読めないデータは理由つきで拒否する', () => {
  assert.equal(reason(() => parseImport('こんにちは')), 'format');
  assert.equal(reason(() => parseImport('{"type":"golf-round"')), 'format');
  assert.equal(reason(() => parseImport(text(sampleImport({ type: 'x' })))), 'format');
  assert.equal(reason(() => parseImport(text(sampleImport({ type: 'golf-backup' })))), 'backup');
  assert.equal(reason(() => parseImport(text(sampleImport({ schema: undefined })))), 'noschema');
  assert.equal(reason(() => parseImport(text(sampleImport({ schema: 2 })))), 'newer');
  assert.equal(reason(() => parseImport(text(sampleImport({ date: '2026/3/29' })))), 'date');
  assert.equal(reason(() => parseImport(text(sampleImport({ course: {} })))), 'course');
  assert.equal(reason(() => parseImport(text(sampleImport({ holes: [] })))), 'holes');
  assert.equal(reason(() => parseImport(text(sampleImport({ holeCount: 9 })))), 'holes');
  assert.equal(reason(() => parseImport(text(sampleImport({ players: [{ id: 'p2', name: '田中' }] })))), 'players');
  const noStroke = sampleImport();
  delete noStroke.holes[5].strokes.p1;
  assert.equal(reason(() => parseImport(text(noStroke))), 'strokes');
});

test('当てはまらないクラブ・方向は空欄にして要確認にする。バンカーの true/false は回数に直す', () => {
  const o = sampleImport();
  o.holes[0].self.club = '4W';
  o.holes[0].self.direction = 'oneon'; // パー4にワンオンは合わない
  o.holes[0].self.bunker = true;
  o.holes[1].self.putt = null; // 話し忘れ
  const d = parseImport(text(o));
  assert.equal(d.allHoles[0].self.club, null);
  assert.equal(d.allHoles[0].self.direction, null);
  assert.equal(d.allHoles[0].self.bunker, 1);
  assert.ok(d.allHoles[0].check.includes('club') && d.allHoles[0].check.includes('direction'));
  assert.equal(d.allHoles[1].self.putt, null);
  assert.ok(!d.allHoles[1].check.includes('putt')); // 空欄は要確認にしない
});

test('名前の照合は空白・全角半角・大文字小文字を無視し、記号は残す', () => {
  const st = emptyData();
  st.courses.push({ id: 'c1', facility: '木津川カントリー倶楽部【ＰＧＭ】', nines: ['笠置', '木津川'], holeCount: 18, holes: [] });
  st.companions.push({ id: 'm1', name: 'Ｔａｎａｋａ 太郎' });
  assert.equal(matchCourse(st, '木津川 カントリー倶楽部【pgm】', ['笠置', '木津川'], 18)?.id, 'c1');
  assert.equal(matchCourse(st, '木津川カントリー倶楽部', ['笠置', '木津川'], 18), null); // 【PGM】がない
  assert.equal(matchCourse(st, '木津川カントリー倶楽部【PGM】', ['木津川', '笠置'], 18), null); // 前半後半が逆
  assert.equal(matchCourse(st, '木津川カントリー倶楽部【PGM】', ['笠置'], 9), null); // ホール数が違う
  assert.equal(matchCompanion(st, 'tanaka太郎')?.id, 'm1');
});

test('要確認が残る間は登録できない。確認が済めば登録でき、コースと同伴者が新規登録される', () => {
  const st = emptyData();
  const d = prepareDraft(st, parseImport(text(sampleImport())));
  assert.equal(d.courseSel, 'new');
  let info = issues(st, d);
  assert.equal(info.checks, 2);
  assert.equal(info.canRegister, false);
  assert.throws(() => register(st, d));
  clearChecks(d);
  info = issues(st, d);
  assert.equal(info.canRegister, true);
  const id = register(st, d);
  assert.equal(st.rounds.length, 1);
  assert.equal(st.courses.length, 1);
  assert.equal(st.companions.length, 1);
  const r = st.rounds[0];
  assert.equal(r.id, id);
  assert.equal(r.courseId, st.courses[0].id);
  assert.deepEqual(r.companionIds, [st.companions[0].id]);
  assert.equal(r.holes[0].strokes.self, 5);
  assert.equal(r.holes[0].strokes[st.companions[0].id], 4);
  assert.equal(r.holes[0].par, 4); // パー・ヤード数をコピーして持つ
  assert.equal(st.courses[0].holes[9].no, 1);
  assert.equal(r.holes[0].check, undefined); // 要確認の印は保存しない
});

test('二重取り込みは、上書きか追加を選ぶまで登録できない', () => {
  const st = emptyData();
  const d1 = prepareDraft(st, parseImport(text(sampleImport())));
  clearChecks(d1);
  const firstId = register(st, d1);

  const o = sampleImport();
  o.holes[0].strokes.p1 = 6;
  o.printedTotals.p1 = 92;
  const d2 = prepareDraft(st, parseImport(text(o)));
  clearChecks(d2);
  assert.notEqual(d2.courseSel, 'new'); // 登録済みのコースに一致
  assert.equal(d2.players[1].sel, st.companions[0].id); // 登録済みの同伴者に一致
  let info = issues(st, d2);
  assert.ok(info.dup);
  assert.equal(info.canRegister, false);
  d2.dupChoice = 'overwrite';
  assert.equal(register(st, d2), firstId);
  assert.equal(st.rounds.length, 1);
  assert.equal(st.rounds[0].holes[0].strokes.self, 6);

  const d3 = prepareDraft(st, parseImport(text(sampleImport())));
  clearChecks(d3);
  d3.dupChoice = 'add';
  register(st, d3);
  assert.equal(st.rounds.length, 2);
  assert.equal(st.courses.length, 1);
  assert.equal(st.companions.length, 1);
});

test('合計が合わないときは、直すか「そのまま登録」を選ぶまで登録できない', () => {
  const st = emptyData();
  const d = prepareDraft(st, parseImport(text(sampleImport({ printedTotals: { p1: 95, p2: 82 } }))));
  clearChecks(d);
  let info = issues(st, d);
  assert.equal(info.totals.length, 1);
  assert.deepEqual({ printed: info.totals[0].printed, actual: info.totals[0].actual }, { printed: 95, actual: 91 });
  assert.equal(info.canRegister, false);
  d.totalAck = true;
  assert.equal(issues(st, d).canRegister, true);
});

test('同伴者が4人以上のときは、3人以下に直すまで登録できない', () => {
  const o = sampleImport();
  for (const id of ['p3', 'p4', 'p5']) {
    o.players.push({ id, name: `同伴${id}` });
    o.holes.forEach((h) => (h.strokes[id] = 5));
  }
  const st = emptyData();
  const d = prepareDraft(st, parseImport(text(o)));
  clearChecks(d);
  assert.equal(issues(st, d).tooMany, true);
  assert.equal(issues(st, d).canRegister, false);
  d.players[4].sel = 'skip';
  assert.equal(issues(st, d).tooMany, false);
  assert.equal(issues(st, d).canRegister, true);
  register(st, d);
  assert.equal(st.rounds[0].companionIds.length, 3);
  assert.equal(st.companions.length, 3);
});

test('コースの不一致: パーが登録済みコースと違うと警告し、「コースを直す」でコース側を合わせられる', () => {
  const st = emptyData();
  const d1 = prepareDraft(st, parseImport(text(sampleImport())));
  clearChecks(d1);
  register(st, d1);

  const o = sampleImport({ date: '2026-04-05' });
  o.holes[0].par = 5;
  const d = prepareDraft(st, parseImport(text(o)));
  clearChecks(d);
  assert.equal(issues(st, d).courseMismatch, true);
  assert.equal(issues(st, d).canRegister, false);
  fixCourse(st, d);
  assert.equal(st.courses[0].holes[0].par, 5);
  assert.equal(issues(st, d).courseMismatch, false);
  assert.equal(st.rounds[0].holes[0].par, 4); // 過去のラウンドは変わらない
});

test('ホール数を9に直すと前の9ホールだけが対象になる', () => {
  const st = emptyData();
  const d = prepareDraft(st, parseImport(text(sampleImport())));
  clearChecks(d);
  d.holeCount = 9;
  assert.equal(draftHoles(d).length, 9);
  assert.equal(issues(st, d).totals.length, 0); // 印刷の合計は18ホール分なので照合しない
  register(st, d);
  assert.equal(st.rounds[0].holeCount, 9);
  assert.deepEqual(st.courses[0].nines, ['笠置']);
});
