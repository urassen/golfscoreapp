// 同伴者管理: 一覧と編集。
import { companionCount, getState } from '../store.js';
import { esc, normName, uid } from '../util.js';
import { dialog, go, rerender, trySave } from '../ui.js';

let form = null; // { id, name, error }

export function render() {
  const st = getState();
  const rows = st.companions
    .map(
      (c) =>
        `<a class="item" href="#/companion/${encodeURIComponent(c.id)}"><div>${esc(c.name)}</div><div>${companionCount(st, c.id)}回 ›</div></a>`
    )
    .join('');
  return (
    '<header class="bar"><a class="back" href="#/settings">‹設定</a><h1>同伴者管理</h1><a class="act" href="#/companion/new" aria-label="追加">＋</a></header>' +
    (rows ? `<div class="list">${rows}</div>` : '<p class="note center">同伴者はまだいません。</p>')
  );
}

export function renderEdit(id) {
  const st = getState();
  if (!form || form.id !== id) {
    const c = st.companions.find((x) => x.id === id);
    form = { id, name: c ? c.name : '', error: '' };
  }
  const isNew = id === 'new';
  if (!isNew && !st.companions.some((x) => x.id === id)) {
    return '<header class="bar"><a class="back" href="#/companions">‹戻る</a><h1>同伴者</h1></header><p class="note center">同伴者が見つかりません。</p>';
  }
  return (
    '<header class="bar"><a class="back" href="#/companions">‹戻る</a><h1>同伴者</h1><button class="act" data-act="save">保存</button></header>' +
    `<label class="field"><span>名前</span><input id="c-name" type="text" maxlength="30" value="${esc(form.name)}"></label>` +
    (form.error ? `<p class="err" role="alert">${esc(form.error)}</p>` : '') +
    (isNew ? '' : '<p class="note">名前を直すと、過去のラウンドの表示にも反映されます。</p><button class="btn danger wide" data-act="delete">削除</button>')
  );
}

export function onInputEdit(e) {
  if (e.target.id === 'c-name' && form) form.name = e.target.value;
}

export async function onClickEdit(e, id) {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const st = getState();
  if (act === 'save' && form) {
    const name = form.name.trim();
    if (!name) {
      form.error = '名前を入れてください。';
      return rerender();
    }
    if (st.companions.some((c) => c.id !== id && normName(c.name) === normName(name))) {
      form.error = '同じ名前の同伴者が登録されています。区別できる名前にしてください(例: 田中(会社))。';
      return rerender();
    }
    const res = await trySave((s) => {
      if (id === 'new') s.companions.push({ id: uid(), name });
      else s.companions.find((c) => c.id === id).name = name;
    });
    if (res.ok) {
      form = null;
      go('#/companions');
    }
    return;
  }
  if (act === 'delete') {
    if (companionCount(st, id) > 0) {
      await dialog({ message: '過去のラウンドに出ているため削除できません。名前を直すことはできます。' });
      return;
    }
    const yes = await dialog({ message: 'この同伴者を削除します。', ok: '削除', cancel: 'やめる', danger: true });
    if (!yes) return;
    const res = await trySave((s) => {
      s.companions = s.companions.filter((c) => c.id !== id);
    });
    if (res.ok) {
      form = null;
      go('#/companions');
    }
  }
}

export function enterEdit() {
  form = null;
}
