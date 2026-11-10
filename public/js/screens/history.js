// 履歴(ラウンド一覧): 新しい順。
import { getState } from '../store.js';
import { sortedRounds } from '../stats.js';
import { courseLabel, esc, fmtDate } from '../util.js';
import { parTotal, strokeTotal } from '../model.js';

export function render() {
  const st = getState();
  const rs = sortedRounds(st);
  if (!rs.length) return '<header class="bar"><h1>履歴</h1></header><p class="note center">まだラウンドがありません。</p>';
  const rows = rs
    .map((r) => {
      const course = st.courses.find((c) => c.id === r.courseId);
      const total = strokeTotal(r.holes, 'self');
      const diff = total - parTotal(r.holes);
      return (
        `<a class="item" href="#/round/${encodeURIComponent(r.id)}"><div><span class="date">${esc(fmtDate(r.date))}</span> ` +
        `${esc(courseLabel(course))}${r.holeCount === 9 ? ' <span class="tag">9H</span>' : ''}</div>` +
        `<div class="score">${total} <small>(${diff >= 0 ? '+' : ''}${diff})</small></div></a>`
      );
    })
    .join('');
  return `<header class="bar"><h1>履歴</h1></header><div class="list">${rows}</div>`;
}
