import test from 'node:test';
import assert from 'node:assert/strict';
import { stackedBars } from '../public/js/charts.js';

test('積み上げ棒: 棒の中にそれ以外とパットの数、平均の横線2本と数字を出す', () => {
  const svg = stackedBars([{ total: 113, putts: 39 }, { total: 99, putts: 34 }], { avgTotal: 106, avgPutt: 36.5 });
  assert.match(svg, /class="c-in-other"[^>]*>74</);
  assert.match(svg, /class="c-in-putt"[^>]*>39</);
  assert.match(svg, /class="c-avg"/);
  assert.match(svg, /class="c-pavg"/);
  assert.match(svg, /aria-label="平均">106\.0</);
  assert.match(svg, /aria-label="パット">36\.5</);
});

test('積み上げ棒: パット不明のラウンドは中の数字を出さず、平均がなければ線も引かない', () => {
  const svg = stackedBars([{ total: 113, putts: null }, { total: 99, putts: null }], { avgTotal: 106, avgPutt: null });
  assert.doesNotMatch(svg, /c-in-/);
  assert.match(svg, /class="c-avg"/);
  assert.doesNotMatch(svg, /class="c-pavg"/);
});

test('積み上げ棒: 棒が細いときは中の数字を出さない。ミニは線だけで数字なし', () => {
  const many = Array.from({ length: 30 }, () => ({ total: 110, putts: 38 }));
  assert.doesNotMatch(stackedBars(many, { avgTotal: 110, avgPutt: 38 }), /c-in-/);
  const mini = stackedBars([{ total: 113, putts: 39 }, { total: 99, putts: 34 }], { mini: true, avgTotal: 106, avgPutt: 36.5 });
  assert.match(mini, /class="c-avg"/);
  assert.doesNotMatch(mini, /c-in-|c-avg-label|c-label/);
});
