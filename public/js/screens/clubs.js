// クラブ管理: 自分が使うクラブを、候補から選ぶか、名前を入れて登録する。
import { getState } from '../store.js';
import { CLUB_CANDIDATES, esc, findClub, sortClubs } from '../util.js';
import { rerender, trySave } from '../ui.js';

let form = { name: '', error: '' };

export function enter() {
  form = { name: '', error: '' };
}

export function render() {
  const clubs = getState().clubs;
  const rest = CLUB_CANDIDATES.filter((c) => !findClub(clubs, c));
  return (
    '<header class="bar"><a class="back" href="#/settings">‹設定</a><h1>クラブ管理</h1><span class="act"></span></header>' +
    `<section class="card"><h2>■ 使うクラブ (${clubs.length})</h2>` +
    '<p class="note">取り込みや編集のときに、ここから選びます。×で外せます。外しても、過去のラウンドの記録はそのまま残ります。</p>' +
    `<div class="row wrap">${
      clubs.length
        ? clubs.map((c) => `<button class="chip" data-act="rm" data-c="${esc(c)}" aria-label="${esc(c)}を外す">${esc(c)} ×</button>`).join('')
        : '<span class="note">まだありません。</span>'
    }</div></section>` +
    '<section class="card"><h2>■ 候補から足す</h2>' +
    `<div class="row wrap">${
      rest.length
        ? rest.map((c) => `<button class="chip" data-act="add" data-c="${esc(c)}">＋${esc(c)}</button>`).join('')
        : '<span class="note">候補はすべて登録済みです。</span>'
    }</div></section>` +
    '<section class="card"><h2>■ 名前を入れて足す</h2>' +
    '<p class="note">候補にないクラブ(52°など)を足せます。</p>' +
    `<div class="row"><input id="club-name" type="text" maxlength="12" placeholder="例: 52°" value="${esc(form.name)}">` +
    '<button class="btn" data-act="add-name">足す</button></div>' +
    (form.error ? `<p class="err" role="alert">${esc(form.error)}</p>` : '') +
    '</section>'
  );
}

export function onInput(e) {
  if (e.target.id === 'club-name') form.name = e.target.value;
}

async function save(fn) {
  const res = await trySave(fn);
  if (res.ok) rerender();
  return res.ok;
}

export async function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'rm') {
    const c = b.dataset.c;
    return save((s) => {
      s.clubs = s.clubs.filter((x) => x !== c);
    });
  }
  if (act === 'add') {
    const c = b.dataset.c;
    return save((s) => {
      if (!findClub(s.clubs, c)) s.clubs = sortClubs([...s.clubs, c]);
    });
  }
  if (act === 'add-name') {
    const name = form.name.normalize('NFKC').trim();
    if (!name) {
      form.error = 'クラブの名前を入れてください。';
      return rerender();
    }
    if (findClub(getState().clubs, name)) {
      form.error = 'そのクラブは登録済みです。';
      return rerender();
    }
    form.error = '';
    const ok = await save((s) => {
      // 候補と同じクラブなら、候補の表記にそろえる(u5 → U5)。
      s.clubs = sortClubs([...s.clubs, findClub(CLUB_CANDIDATES, name) || name]);
    });
    if (ok) {
      form.name = '';
      rerender();
    }
  }
}
