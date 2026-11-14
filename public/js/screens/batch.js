// まとめて確認: まとめ取り込みの全ラウンドの状態を並べ、登録できる分をまとめて登録する。
import { getState } from '../store.js';
import { courseLabel, esc, fmtDate } from '../util.js';
import { strokeTotal } from '../model.js';
import { batchDuplicateOf, draftHoles, draftNines, issues, registerBatch, rematch, selectedCourse } from '../importer.js';
import { go, rerender, toast, trySave } from '../ui.js';
import { box, clearBox } from './draftbox.js';

/** 1件の状態。ok が true なら、まとめて登録の対象。 */
export function itemStatus(st, items, i) {
  const it = items[i];
  if (!it.draft) return { ok: false, text: `読めません: ${it.error}`, error: true };
  const d = it.draft;
  const dupIdx = batchDuplicateOf(items, i);
  if (dupIdx >= 0) return { ok: false, text: `⚠ この取り込みの${items[dupIdx].no ?? dupIdx + 1}件目と同じラウンド` };
  const info = issues(st, d);
  if (info.checks) return { ok: false, text: `⚠ 要確認 ${info.checks}か所` };
  if (info.strokeMissing || info.parMissing) return { ok: false, text: '⚠ 空欄があります' };
  if (info.tooMany) return { ok: false, text: '⚠ 同伴者が4人以上' };
  if (info.sameCompanion) return { ok: false, text: '⚠ 同伴者を選び直してください' };
  if (info.courseMismatch) return { ok: false, text: '⚠ 登録済みのコースと違います' };
  if (info.totalMismatch) return { ok: false, text: '⚠ 合計が合いません' };
  if (info.dup && !d.dupChoice) return { ok: false, text: '⚠ 同じラウンドが既にあります' };
  return { ok: true, text: '✓ 登録できます' };
}

export function render() {
  const items = box.batch;
  const head =
    `<header class="bar"><a class="back" href="#/import">‹取り込み</a><h1>まとめて確認${items ? ` (${items.length}件)` : ''}</h1>` +
    '<button class="act" data-act="cancel">キャンセル</button></header>';
  if (!items || !items.length) {
    return head + '<p class="note center">取り込むデータがありません。</p><a class="btn wide" href="#/import">取り込みへ</a>';
  }
  const st = getState();
  let okCount = 0;
  const rows = items
    .map((it, i) => {
      const s = itemStatus(st, items, i);
      if (s.ok) okCount++;
      if (!it.draft) {
        return `<div class="item bad"><div><span class="date">${it.no ?? i + 1}件目</span><br><span class="err">${esc(s.text)}</span></div></div>`;
      }
      const d = it.draft;
      const course = selectedCourse(st, d);
      const label = courseLabel(course || { facility: d.facility, nines: draftNines(d) });
      return (
        `<a class="item" href="#/confirm/${i}"><div><span class="date">${esc(fmtDate(d.date))}</span> ${esc(label)}` +
        `${d.holeCount === 9 ? ' <span class="tag">9H</span>' : ''}<br>` +
        `<span class="${s.ok ? 'okmark' : 'warn'}">${esc(s.text)}</span></div>` +
        `<div class="score">${strokeTotal(draftHoles(d), 'self')} ›</div></a>`
      );
    })
    .join('');
  return (
    head +
    '<p class="note">⚠のラウンドは、タップして直してください。直したら一覧に戻り、まとめて登録します。</p>' +
    `<div class="list">${rows}</div>` +
    `<div class="footer"><button class="btn primary wide" data-act="register" ${okCount ? '' : 'disabled'}>` +
    `${okCount ? `登録できる${okCount}件を登録` : '登録できるラウンドがありません'}</button></div>`
  );
}

export async function onClick(e) {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'cancel') {
    clearBox();
    return go('#/import');
  }
  if (act !== 'register' || !box.batch) return;
  const items = box.batch;
  const res = await trySave((s) => registerBatch(s, items));
  if (!res.ok) return;
  const done = new Set(res.value);
  if (!done.size) {
    toast('登録できるラウンドがありませんでした');
    return rerender();
  }
  box.batch = items.filter((_, i) => !done.has(i));
  // 今登録したラウンドで作ったコース・同伴者に、残りのラウンドを合わせる(重複もここで分かる)。
  const st = getState();
  box.batch.forEach((it) => it.draft && rematch(st, it.draft));
  toast(`${done.size}件を登録しました`);
  if (!box.batch.some((it) => it.draft)) {
    clearBox();
    return go('#/history');
  }
  rerender();
}
