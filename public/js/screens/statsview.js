// 統計: 絞り込みと、スコア・プレー内容。
import { getState } from '../store.js';
import { courseLabel, esc, fmtDate } from '../util.js';
import { filterRounds, num1, rateText, summarize, yearsOf } from '../stats.js';
import { bandBar, pairBars, stackedBars } from '../charts.js';
import { rerender } from '../ui.js';

const f = { holeCount: 18, courseId: '', period: '10' };
let tap = null; // グラフでタップした棒の番号

const pct = (v, n) => (n ? Math.round((v / n) * 100) : 0);

function filters(st) {
  const courses = st.courses.filter((c) => c.holeCount === f.holeCount);
  if (f.courseId && !courses.some((c) => c.id === f.courseId)) f.courseId = '';
  const periods = [
    ['5', '直近5回'],
    ['10', '直近10回'],
    ['20', '直近20回'],
    ['all', '全部'],
    ...yearsOf(st).map((y) => [`y${y}`, `${y}年`]),
  ];
  return (
    '<div class="sticky filters"><div class="seg">' +
    `<button data-act="hc" data-v="18" class="${f.holeCount === 18 ? 'on' : ''}">18ホール</button>` +
    `<button data-act="hc" data-v="9" class="${f.holeCount === 9 ? 'on' : ''}">9ホール</button></div>` +
    '<div class="row"><select data-f="course" aria-label="コース"><option value="">全コース</option>' +
    courses.map((c) => `<option value="${esc(c.id)}" ${f.courseId === c.id ? 'selected' : ''}>${esc(courseLabel(c))}</option>`).join('') +
    '</select><select data-f="period" aria-label="期間">' +
    periods.map(([v, l]) => `<option value="${esc(v)}" ${f.period === v ? 'selected' : ''}>${esc(l)}</option>`).join('') +
    '</select></div></div>'
  );
}

export function render() {
  const st = getState();
  const head = '<header class="bar"><h1>統計</h1></header>' + filters(st);
  const s = summarize(filterRounds(st, f));
  if (!s.count) return head + '<p class="note center">該当するラウンドがありません</p>';

  const graphs = s.count >= 2;
  const b = s.breakdown;
  const unknown = s.lines.some((l) => l.putts == null);
  let tapLine = '';
  if (graphs && tap != null && s.lines[tap]) {
    const l = s.lines[tap];
    const c = st.courses.find((x) => x.id === l.courseId);
    tapLine = `<p class="tapinfo">${esc(fmtDate(l.date))} ${esc(courseLabel(c))} ${l.total}${l.putts == null ? '' : `(パット${l.putts})`} バンカー${l.bunker} OB${l.ob}</p>`;
  }

  let score = '<section class="card"><h2>■ スコア (自分)</h2>';
  if (graphs) {
    score +=
      `<h3>合計スコアの推移</h3><div data-chart="1">${stackedBars(s.lines)}</div>` +
      `<p class="legend"><span class="lg c-other"></span>それ以外 <span class="lg c-putt"></span>パット${
        unknown ? ' <span class="lg c-unknown"></span>パット不明' : ''
      }</p>${tapLine}`;
  }
  score +=
    `<p>平均 <b>${num1(s.avg)}</b>　ベスト <b>${s.best}</b>　ラウンド数 <b>${s.count}</b></p>` +
    `<p>パット平均 <b>${num1(s.puttAvg)}</b>　3パット <b>${s.threePutts}回</b></p>` +
    `<h3>パー別の平均打数</h3><p>パー3 <b>${num1(s.parAvg[3])}</b>　パー4 <b>${num1(s.parAvg[4])}</b>　パー5 <b>${num1(s.parAvg[5])}</b></p>` +
    '<h3>内訳</h3>' +
    bandBar([
      { cls: 'c-good', value: b.parOrBetter },
      { cls: 'c-bogey', value: b.bogey },
      { cls: 'c-double', value: b.double },
    ]) +
    `<p><span class="lg c-good"></span>パー以下 ${pct(b.parOrBetter, b.n)}% (${b.parOrBetter})　` +
    `<span class="lg c-bogey"></span>ボギー ${pct(b.bogey, b.n)}% (${b.bogey})　` +
    `<span class="lg c-double"></span>ダブルボギー以上 ${pct(b.double, b.n)}% (${b.double})</p></section>`;

  let play =
    '<section class="card"><h2>■ プレー内容 (自分)</h2>' +
    `<p>FWキープ率 <b>${esc(rateText(s.fw.hit, s.fw.n))}</b></p>` +
    `<p>パーオン率(推定) <b>${esc(rateText(s.gir.hit, s.gir.n))}</b></p>`;
  if (graphs) {
    play +=
      `<h3>バンカー・OBの回数の推移</h3><div data-chart="1">${pairBars(s.lines.map((l) => ({ a: l.bunker, b: l.ob })))}</div>` +
      '<p class="legend"><span class="lg c-bunker"></span>バンカー <span class="lg c-ob"></span>OB</p>';
  } else {
    play += `<p>バンカー <b>${s.lines[0].bunker}回</b>　OB <b>${s.lines[0].ob}回</b></p>`;
  }
  play += '</section>';
  return head + score + play;
}

export function enter() {
  tap = null;
}

export function onChange(e) {
  const k = e.target.dataset.f;
  if (k === 'course') f.courseId = e.target.value;
  else if (k === 'period') f.period = e.target.value;
  else return;
  tap = null;
  rerender();
}

export function onClick(e) {
  const b = e.target.closest('[data-act="hc"]');
  if (b) {
    f.holeCount = Number(b.dataset.v) === 9 ? 9 : 18;
    tap = null;
    return rerender();
  }
  const hit = e.target.closest('.c-hit');
  if (hit) {
    tap = Number(hit.dataset.i);
    rerender();
  }
}
