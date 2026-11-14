// 履歴(ラウンド一覧): 新しい順。同伴者(全員を含む)と年で絞り込める。
import { getState } from '../store.js';
import { filterHistory, yearsOf } from '../stats.js';
import { courseLabel, esc, fmtDate } from '../util.js';
import { parTotal, strokeTotal } from '../model.js';
import { closeOverlay, openSheet, rerender } from '../ui.js';

// 絞り込みの条件。アプリを開いている間だけ残す。
const f = { companionIds: [], year: '' };

function filterBar(st) {
  // 削除などで消えた同伴者や、データのない年は条件から外す。
  f.companionIds = f.companionIds.filter((id) => st.companions.some((c) => c.id === id));
  const years = yearsOf(st);
  if (f.year && !years.includes(f.year)) f.year = '';
  const chips = f.companionIds
    .map((id) => {
      const c = st.companions.find((x) => x.id === id);
      return `<button class="chip" data-act="rm" data-id="${esc(id)}" aria-label="${esc(c.name)}を外す">${esc(c.name)} ×</button>`;
    })
    .join('');
  const canAdd = st.companions.length > f.companionIds.length;
  return (
    '<div class="sticky filters">' +
    `<div class="row wrap"><span class="flabel">同伴者</span>${chips}${
      canAdd ? '<button class="chip add" data-act="add" aria-label="同伴者を選ぶ">＋</button>' : ''
    }</div>` +
    '<div class="row"><span class="flabel">年</span><select data-f="year" aria-label="年">' +
    `<option value="">すべての年</option>${years
      .map((y) => `<option value="${esc(y)}" ${f.year === y ? 'selected' : ''}>${esc(y)}年</option>`)
      .join('')}</select></div>` +
    '</div>'
  );
}

export function render() {
  const st = getState();
  const head = '<header class="bar"><h1>履歴</h1></header>';
  if (!st.rounds.length) return head + '<p class="note center">まだラウンドがありません。</p>';
  const rs = filterHistory(st, f);
  const filtered = f.companionIds.length > 0 || f.year !== '';
  const bar = filterBar(st);
  const count = filtered
    ? `<div class="row count"><span>${rs.length}件</span><button class="btn small" data-act="clear">解除</button></div>`
    : '';
  if (!rs.length) return head + bar + count + '<p class="note center">条件に合うラウンドがありません</p>';
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
  return head + bar + count + `<div class="list">${rows}</div>`;
}

export function onChange(e) {
  if (e.target.dataset.f !== 'year') return;
  f.year = e.target.value;
  rerender();
}

export function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'rm') {
    f.companionIds = f.companionIds.filter((id) => id !== b.dataset.id);
    return rerender();
  }
  if (act === 'clear') {
    f.companionIds = [];
    f.year = '';
    return rerender();
  }
  if (act === 'add') {
    const st = getState();
    const rest = st.companions.filter((c) => !f.companionIds.includes(c.id));
    openSheet(
      '<h3>同伴者を選ぶ</h3><p class="note">複数選ぶと、全員が一緒だったラウンドを出します。</p><div class="choices names">' +
        rest.map((c) => `<button class="btn" data-pick="${esc(c.id)}">${esc(c.name)}</button>`).join('') +
        '</div><div class="row"><button class="btn" data-close="1">閉じる</button></div>',
      (ev) => {
        const p = ev.target.closest('button');
        if (!p) return;
        closeOverlay();
        if (p.dataset.pick) {
          f.companionIds.push(p.dataset.pick);
          rerender();
        }
      }
    );
  }
}
