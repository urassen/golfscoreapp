// コース管理: 一覧と編集。
import { courseUsed, getState } from '../store.js';
import { courseLabel, esc, isNum, normName, uid } from '../util.js';
import { dialog, go, rerender, trySave } from '../ui.js';

let form = null;

export function render() {
  const st = getState();
  const rows = st.courses
    .map((c) => {
      const noYard = c.holes.some((h) => !isNum(h.yard));
      return (
        `<a class="item" href="#/course/${encodeURIComponent(c.id)}"><div>${esc(courseLabel(c))}<br><small>${c.holeCount}ホール` +
        `${noYard ? ' <span class="warn">⚠ヤード数が未入力</span>' : ''}</small></div><div>›</div></a>`
      );
    })
    .join('');
  return (
    '<header class="bar"><a class="back" href="#/settings">‹設定</a><h1>コース管理</h1><a class="act" href="#/course/new" aria-label="追加">＋</a></header>' +
    (rows ? `<div class="list">${rows}</div>` : '<p class="note center">コースはまだありません。</p>')
  );
}

function newForm(st, id) {
  const c = st.courses.find((x) => x.id === id);
  const holes = [];
  for (let i = 0; i < 18; i++) {
    const h = c?.holes[i];
    holes.push({ par: h?.par ?? 4, yard: h?.yard ?? null });
  }
  return {
    id,
    facility: c?.facility ?? '',
    holeCount: c?.holeCount ?? 18,
    nines: [c?.nines?.[0] ?? '', c?.nines?.[1] ?? ''],
    starts: [c?.holes[0]?.no ?? 1, c?.holes[9]?.no ?? 10],
    holes,
    error: '',
  };
}

export function enterEdit() {
  form = null;
}

export function renderEdit(id) {
  const st = getState();
  const isNew = id === 'new';
  if (!isNew && !st.courses.some((x) => x.id === id)) {
    return '<header class="bar"><a class="back" href="#/courses">‹戻る</a><h1>コース</h1></header><p class="note center">コースが見つかりません。</p>';
  }
  if (!form || form.id !== id) form = newForm(st, id);
  const f = form;
  const halves = f.holeCount / 9;
  let nineInputs = '';
  for (let k = 0; k < halves; k++) {
    const label = halves === 1 ? '' : k === 0 ? '前半の' : '後半の';
    nineInputs +=
      `<label class="field"><span>${label}名称(省略可)</span><input type="text" maxlength="20" data-k="nine${k}" value="${esc(f.nines[k])}"></label>` +
      `<label class="field"><span>${label}最初のホール番号</span><input type="number" inputmode="numeric" min="1" max="99" data-k="start${k}" value="${esc(f.starts[k])}"></label>`;
  }
  let rows = '';
  for (let i = 0; i < f.holeCount; i++) {
    const k = Math.floor(i / 9);
    const no = (Number(f.starts[k]) || 1) + (i % 9);
    const h = f.holes[i];
    rows +=
      `<tr><td class="hno">${no}</td><td><select data-k="par:${i}" aria-label="${no}番のパー">` +
      [3, 4, 5].map((p) => `<option ${h.par === p ? 'selected' : ''}>${p}</option>`).join('') +
      `</select></td><td><input type="number" inputmode="numeric" min="1" max="999" data-k="yard:${i}" aria-label="${no}番のヤード数" value="${
        isNum(h.yard) ? h.yard : ''
      }"></td></tr>`;
    if (i === 8 && f.holeCount === 18) rows += '<tr class="sub"><td colspan="3">後半</td></tr>';
  }
  return (
    '<header class="bar"><a class="back" href="#/courses">‹戻る</a><h1>コース</h1><button class="act" data-act="save">保存</button></header>' +
    (f.error ? `<p class="err" role="alert">${esc(f.error)}</p>` : '') +
    `<label class="field"><span>施設名</span><input type="text" maxlength="40" data-k="facility" value="${esc(f.facility)}"></label>` +
    `<label class="field"><span>ホール数</span><select data-k="holeCount"><option ${f.holeCount === 18 ? 'selected' : ''}>18</option><option ${
      f.holeCount === 9 ? 'selected' : ''
    }>9</option></select></label>` +
    nineInputs +
    '<p class="note">自分が使うティーのヤード数を1組だけ入れます。27ホールの施設は、回る組み合わせごとに別のコースとして登録します。</p>' +
    `<section class="tbl"><div class="scroll"><table class="formtbl"><thead><tr><th>ホ</th><th>パー</th><th>ヤード</th></tr></thead><tbody>${rows}</tbody></table></div></section>` +
    (isNew ? '' : '<button class="btn danger wide" data-act="delete">削除</button>')
  );
}

function readInput(t) {
  const f = form;
  const k = t.dataset.k;
  if (!f || !k) return false;
  if (k === 'facility') f.facility = t.value;
  else if (k === 'nine0') f.nines[0] = t.value;
  else if (k === 'nine1') f.nines[1] = t.value;
  else if (k === 'start0') f.starts[0] = t.value;
  else if (k === 'start1') f.starts[1] = t.value;
  else if (k === 'holeCount') f.holeCount = Number(t.value) === 9 ? 9 : 18;
  else if (k.startsWith('par:')) f.holes[Number(k.slice(4))].par = Number(t.value);
  else if (k.startsWith('yard:')) f.holes[Number(k.slice(5))].yard = t.value === '' ? null : Number(t.value);
  return k === 'holeCount' || k.startsWith('start');
}

export function onInputEdit(e) {
  readInput(e.target);
}
export function onChangeEdit(e) {
  if (readInput(e.target)) rerender();
}

function validate(st, f, id) {
  const facility = f.facility.trim();
  if (!facility) return '施設名を入れてください。';
  const halves = f.holeCount / 9;
  const starts = f.starts.slice(0, halves).map(Number);
  if (starts.some((s) => !Number.isInteger(s) || s < 1)) return '最初のホール番号を入れてください。';
  const holes = f.holes.slice(0, f.holeCount);
  if (holes.some((h) => ![3, 4, 5].includes(h.par))) return 'パーは3・4・5から選んでください。';
  if (holes.some((h) => h.yard != null && (!Number.isInteger(h.yard) || h.yard < 1))) return 'ヤード数は1以上の数字で入れてください。';
  if (id === 'new' && holes.some((h) => h.yard == null)) return 'ヤード数をすべてのホールに入れてください。';
  const nines = f.nines.slice(0, halves).map((n) => n.trim());
  const same = st.courses.some(
    (c) =>
      c.id !== id &&
      c.holeCount === f.holeCount &&
      normName(c.facility) === normName(facility) &&
      nines.every((n, i) => normName(c.nines?.[i]) === normName(n))
  );
  if (same) return '同じ施設名・名称・ホール数のコースが登録されています。';
  return {
    facility,
    nines,
    holeCount: f.holeCount,
    holes: holes.map((h, i) => ({ no: starts[Math.floor(i / 9)] + (i % 9), par: h.par, yard: h.yard })),
  };
}

export async function onClickEdit(e, id) {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const st = getState();
  if (act === 'save' && form) {
    const v = validate(st, form, id);
    if (typeof v === 'string') {
      form.error = v;
      rerender();
      window.scrollTo(0, 0);
      return;
    }
    const res = await trySave((s) => {
      if (id === 'new') s.courses.push({ id: uid(), ...v });
      else Object.assign(s.courses.find((c) => c.id === id), v);
    });
    if (res.ok) {
      form = null;
      go('#/courses');
    }
    return;
  }
  if (act === 'delete') {
    if (courseUsed(st, id)) {
      await dialog({ message: 'ラウンドに出ているため削除できません。' });
      return;
    }
    const yes = await dialog({ message: 'このコースを削除します。', ok: '削除', cancel: 'やめる', danger: true });
    if (!yes) return;
    const res = await trySave((s) => {
      s.courses = s.courses.filter((c) => c.id !== id);
    });
    if (res.ok) {
      form = null;
      go('#/courses');
    }
  }
}
