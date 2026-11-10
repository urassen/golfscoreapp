// 取り込みの確認画面。
import { getState } from '../store.js';
import { courseLabel, esc } from '../util.js';
import { getField, setField } from '../model.js';
import {
  activePlayers,
  applyCourseDefaults,
  draftHoles,
  draftNines,
  fixCourse,
  issues,
  matchCompanion,
  matchCourse,
  register,
  selectedCourse,
} from '../importer.js';
import { go, rerender, toast, trySave } from '../ui.js';
import { box, clearBox } from './draftbox.js';
import { scoreTables } from './tables.js';
import { editorTitle, openEditor } from './editor.js';

const HEAD =
  '<header class="bar"><a class="back" href="#/import">‹取り込み</a><h1>確認</h1><button class="act" data-act="cancel">キャンセル</button></header>';

function viewPlayers(d) {
  return activePlayers(d).map((p) => ({ key: p.key, name: p.self ? '自分' : p.name }));
}

function bands(d, info) {
  let out = '';
  if (info.dup) {
    const chosen =
      d.dupChoice === 'overwrite' ? '「上書き」を選びました。' : d.dupChoice === 'add' ? '「別ラウンドとして追加」を選びました。' : '';
    out +=
      '<div class="band" role="alert"><p>同じ日付・コース・ホール数のラウンドが既にあります。</p>' +
      (chosen ? `<p class="chosen">${chosen}</p>` : '') +
      '<div class="row wrap">' +
      `<button class="btn ${d.dupChoice === 'overwrite' ? 'on' : ''}" data-act="dup-overwrite">上書き</button>` +
      `<button class="btn ${d.dupChoice === 'add' ? 'on' : ''}" data-act="dup-add">別ラウンドとして追加</button>` +
      '<button class="btn" data-act="cancel">中止</button></div></div>';
  }
  if (info.totalMismatch) {
    out +=
      '<div class="band" role="alert">' +
      info.totals
        .map((t) => `<p>${esc(t.key === 'self' ? '自分' : t.name)}: 読み取った合計(${t.printed})と、ホール別の合計(${t.actual})が合いません。</p>`)
        .join('') +
      '<div class="row wrap"><button class="btn" data-act="total-fix">直す</button>' +
      '<button class="btn" data-act="total-ack">そのまま登録</button></div></div>';
  }
  if (info.courseMismatch) {
    out +=
      '<div class="band" role="alert"><p>ホール数またはパーが、登録済みのコースと違います。</p><div class="row wrap">' +
      '<button class="btn" data-act="mm-reselect">コースを選び直す</button>' +
      '<button class="btn" data-act="mm-fix">コースを直す</button>' +
      '<button class="btn" data-act="mm-ack">そのまま登録</button></div></div>';
  }
  if (info.tooMany) {
    out += '<div class="band" role="alert"><p>同伴者が4人以上います。1ラウンドは3人までです。3人以下に直してください。</p></div>';
  }
  if (info.sameCompanion) {
    out += '<div class="band" role="alert"><p>同じ同伴者が2回選ばれています。選び直してください。</p></div>';
  }
  return out;
}

function infoForm(st, d) {
  const courseOpts =
    st.courses
      .map((c) => `<option value="${esc(c.id)}" ${d.courseSel === c.id ? 'selected' : ''}>${esc(courseLabel(c))} ${c.holeCount}H</option>`)
      .join('') +
    `<option value="new" ${d.courseSel === 'new' ? 'selected' : ''}>新規登録: ${esc(courseLabel({ facility: d.facility, nines: draftNines(d) }))}</option>`;
  const hcOpts =
    d.allHoles.length === 18
      ? `<option value="18" ${d.holeCount === 18 ? 'selected' : ''}>18</option><option value="9" ${d.holeCount === 9 ? 'selected' : ''}>9(前半だけ)</option>`
      : '<option value="9" selected>9</option>';
  const comps = d.players
    .filter((p) => !p.self)
    .map((p) => {
      const same = matchCompanion(st, p.name);
      const opts =
        st.companions.map((c) => `<option value="${esc(c.id)}" ${p.sel === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('') +
        (same ? '' : `<option value="new" ${p.sel === 'new' ? 'selected' : ''}>新規登録: ${esc(p.name)}</option>`) +
        `<option value="skip" ${p.sel === 'skip' ? 'selected' : ''}>取り込まない</option>`;
      return `<label class="field"><span>${esc(p.name)}</span><select data-f="pl:${esc(p.key)}">${opts}</select></label>`;
    })
    .join('');
  return (
    '<section class="card form">' +
    `<label class="field"><span>日付</span><input type="date" data-f="date" value="${esc(d.date)}"></label>` +
    `<label class="field"><span>コース</span><select id="course-sel" data-f="course">${courseOpts}</select></label>` +
    (d.courseSel === 'new' ? '<p class="note">このコースは新しく登録されます。ヤード数は空のままでも登録できます。</p>' : '') +
    `<label class="field"><span>ホール数</span><select data-f="hc">${hcOpts}</select></label>` +
    (comps ? `<h3>同伴者</h3>${comps}` : '<p class="note">同伴者はいません。</p>') +
    '</section>'
  );
}

function blockReason(d, info) {
  if (info.checks) return `要確認の箇所が${info.checks}か所あります。確認済みにするか、数字を直してください。`;
  if (info.strokeMissing) return '打数が空欄のホールがあります。表をタップして入れてください。';
  if (info.parMissing) return 'パーが空欄のホールがあります。表のパーをタップして入れてください。';
  if (info.tooMany) return '同伴者を3人以下に直してください。';
  if (info.sameCompanion) return '同伴者を選び直してください。';
  if (info.courseMismatch) return '上の帯で、コースの扱いを選んでください。';
  if (info.totalMismatch) return '上の帯で、合計の扱いを選んでください。';
  if (info.dup && !d.dupChoice) return '上の帯で、上書きか追加かを選んでください。';
  return '';
}

export function render() {
  const d = box.draft;
  if (!d) {
    return HEAD + '<p class="note center">取り込むデータがありません。</p><a class="btn wide" href="#/import">取り込みへ</a>';
  }
  const st = getState();
  const info = issues(st, d);
  const course = selectedCourse(st, d);
  const label = course ? courseLabel(course) : courseLabel({ facility: d.facility, nines: draftNines(d) });
  const reason = blockReason(d, info);
  return (
    HEAD +
    `<div class="sticky mini">${esc(d.date.replace(/-/g, '/'))} ${esc(label)} ${d.holeCount}H</div>` +
    bands(d, info) +
    infoForm(st, d) +
    '<p class="note">直したいセルをタップしてください。黄色のセルは要確認です。</p>' +
    `<div id="tables">${scoreTables({ players: viewPlayers(d), holes: draftHoles(d), nines: draftNines(d) }, { editable: true })}</div>` +
    `<div class="footer">${reason ? `<p>${esc(reason)}</p>` : ''}` +
    `<button class="btn primary wide" data-act="register" ${info.canRegister ? '' : 'disabled'}>登録</button></div>`
  );
}

function resetCourseFlags(d) {
  d.dupChoice = null;
  d.mismatchAck = false;
  d.fixCourse = false;
}

export function onChange(e) {
  const d = box.draft;
  const f = e.target.dataset.f;
  if (!d || !f) return;
  const st = getState();
  const v = e.target.value;
  if (f === 'date') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) d.date = v;
    d.dupChoice = null;
  } else if (f === 'course') {
    d.courseSel = v;
    resetCourseFlags(d);
    applyCourseDefaults(d, selectedCourse(st, d));
  } else if (f === 'hc') {
    d.holeCount = Number(v) === 9 ? 9 : d.allHoles.length;
    const m = matchCourse(st, d.facility, draftNines(d), d.holeCount);
    d.courseSel = m ? m.id : 'new';
    resetCourseFlags(d);
    applyCourseDefaults(d, m);
  } else if (f.startsWith('pl:')) {
    const p = d.players.find((x) => x.key === f.slice(3));
    if (p) p.sel = v;
  }
  rerender();
}

export async function onClick(e) {
  const d = box.draft;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'cancel') {
    clearBox();
    return go('#/import');
  }
  if (!d) return;
  if (act === 'dup-overwrite' || act === 'dup-add') {
    d.dupChoice = act === 'dup-overwrite' ? 'overwrite' : 'add';
    return rerender();
  }
  if (act === 'total-fix') {
    return document.getElementById('tables')?.scrollIntoView({ behavior: 'smooth' });
  }
  if (act === 'total-ack') {
    d.totalAck = true;
    return rerender();
  }
  if (act === 'mm-reselect') {
    const sel = document.getElementById('course-sel');
    sel?.scrollIntoView({ block: 'center' });
    return sel?.focus();
  }
  if (act === 'mm-fix' || act === 'mm-ack') {
    d.mismatchAck = true;
    d.fixCourse = act === 'mm-fix';
    return rerender();
  }
  if (act === 'register') {
    const res = await trySave((s) => {
      if (d.fixCourse) fixCourse(s, d);
      return register(s, d);
    });
    if (res.ok) {
      clearBox();
      toast('登録しました');
      go(`#/round/${encodeURIComponent(res.value)}`);
    }
    return;
  }
  const td = e.target.closest('td.ed');
  if (!td) return;
  const hole = draftHoles(d)[Number(td.dataset.h)];
  const field = td.dataset.f;
  const uncheck = () => {
    hole.check = hole.check.filter((x) => x !== field);
  };
  openEditor({
    title: editorTitle(hole, field, viewPlayers(d)),
    field,
    par: hole.par,
    value: getField(hole, field),
    checked: hole.check.includes(field),
    onSave: (v) => {
      setField(hole, field, v);
      uncheck();
      if (field.startsWith('s:')) d.totalAck = false;
      if (field === 'par') {
        d.mismatchAck = false;
        d.fixCourse = false;
      }
      rerender();
    },
    onConfirm: () => {
      uncheck();
      rerender();
    },
  });
}
