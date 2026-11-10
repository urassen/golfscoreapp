// ホーム: 直近10回(全コース・18ホール)の平均・ベスト・パット平均、ミニグラフ、取り込むボタン。
import { getState } from '../store.js';
import { filterRounds, num1, summarize } from '../stats.js';
import { stackedBars } from '../charts.js';

export function render() {
  const st = getState();
  if (!st.rounds.length) {
    return (
      '<header class="bar"><h1>ホーム</h1></header>' +
      '<div class="empty"><p>まだラウンドがありません。</p>' +
      '<a class="btn primary wide" href="#/import">取り込む</a>' +
      '<a class="btn wide" href="#/backup">バックアップから復元</a></div>'
    );
  }
  const rs = filterRounds(st, { holeCount: 18, courseId: '', period: '10' });
  const s = summarize(rs);
  let body;
  if (!s.count) {
    body = '<p class="note">18ホールのラウンドがありません。</p>';
  } else {
    body =
      `<section class="card"><h2>直近${s.count}回 (18ホール)</h2><div class="kpis">` +
      `<div><span>平均</span><b>${num1(s.avg)}</b></div>` +
      `<div><span>ベスト</span><b>${s.best}</b></div>` +
      `<div><span>パット</span><b>${num1(s.puttAvg)}</b></div></div></section>`;
    if (s.count >= 2) {
      body += `<a class="card link" href="#/stats" aria-label="統計を開く"><h2>スコア推移</h2>${stackedBars(s.lines, { mini: true })}</a>`;
    }
  }
  return `<header class="bar"><h1>ホーム</h1></header>${body}<a class="btn primary wide" href="#/import">取り込む</a>`;
}
