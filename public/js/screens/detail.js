// ラウンド詳細: 4つの表、編集、削除。
import { getState } from '../store.js';
import { clone, courseLabel, esc, fmtDate } from '../util.js';
import { getField, parTotal, setField, strokeTotal } from '../model.js';
import { dialog, go, rerender, toast, trySave } from '../ui.js';
import { scoreTables } from './tables.js';
import { editorTitle, openEditor } from './editor.js';

let edit = null; // { id, round } 編集中のコピー

function playersOf(st, r) {
  return [
    { key: 'self', name: '自分' },
    ...r.companionIds.map((id) => ({ key: id, name: st.companions.find((c) => c.id === id)?.name ?? '(不明)' })),
  ];
}

export function render(id) {
  const st = getState();
  if (edit && edit.id !== id) edit = null;
  const r = edit ? edit.round : st.rounds.find((x) => x.id === id);
  if (!r) return '<header class="bar"><a class="back" href="#/history">‹履歴</a><h1>ラウンド詳細</h1></header><p class="note center">ラウンドが見つかりません。</p>';
  const course = st.courses.find((c) => c.id === r.courseId);
  const players = playersOf(st, r);
  const par = parTotal(r.holes);
  const totals = players
    .map((p) => {
      const t = strokeTotal(r.holes, p.key);
      return p.key === 'self' ? `自分${t}(${t - par >= 0 ? '+' : ''}${t - par})` : `${esc(p.name)}${t}`;
    })
    .join(' ');
  const head = edit
    ? '<header class="bar"><button class="back" data-act="cancel">キャンセル</button><h1>編集</h1><button class="act" data-act="save">保存</button></header>'
    : '<header class="bar"><a class="back" href="#/history">‹履歴</a><h1>ラウンド詳細</h1><button class="act" data-act="edit">編集</button></header>';
  return (
    head +
    `<section class="card"><div>${esc(fmtDate(r.date))}${r.holeCount === 9 ? ' <span class="tag">9H</span>' : ''}</div>` +
    `<div><b>${esc(courseLabel(course))}</b> (パー${par})</div>` +
    (players.length > 1 ? `<div>同伴: ${players.slice(1).map((p) => esc(p.name)).join(' / ')}</div>` : '') +
    `<div>合計 ${totals}</div></section>` +
    (edit ? '<p class="note">直したいセルをタップしてください。</p>' : '') +
    scoreTables({ players, holes: r.holes, nines: course?.nines || [] }, { editable: !!edit }) +
    (edit ? '' : '<button class="btn danger wide" data-act="delete">削除</button>')
  );
}

export async function onClick(e, id) {
  const st = getState();
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'edit') {
    const r = st.rounds.find((x) => x.id === id);
    if (r) edit = { id, round: clone(r) };
    return rerender();
  }
  if (act === 'cancel') {
    edit = null;
    return rerender();
  }
  if (act === 'save' && edit) {
    const round = edit.round;
    const res = await trySave((s) => {
      const i = s.rounds.findIndex((x) => x.id === id);
      if (i >= 0) s.rounds[i] = round;
    });
    if (res.ok) {
      edit = null;
      toast('保存しました');
      rerender();
    }
    return;
  }
  if (act === 'delete') {
    const yes = await dialog({ message: 'このラウンドを削除します。元に戻せません。', ok: '削除', cancel: 'やめる', danger: true });
    if (!yes) return;
    const res = await trySave((s) => {
      s.rounds = s.rounds.filter((x) => x.id !== id);
    });
    if (res.ok) go('#/history');
    return;
  }
  const td = e.target.closest('td.ed');
  if (td && edit) {
    const hole = edit.round.holes[Number(td.dataset.h)];
    const field = td.dataset.f;
    openEditor({
      title: editorTitle(hole, field, playersOf(st, edit.round)),
      field,
      par: hole.par,
      value: getField(hole, field),
      checked: false,
      onSave: (v) => {
        setField(hole, field, v);
        rerender();
      },
      onConfirm: () => {},
    });
  }
}

export function enter() {
  edit = null;
}
