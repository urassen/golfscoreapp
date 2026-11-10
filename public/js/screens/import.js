// 取り込みの貼り付け画面。
import { getState } from '../store.js';
import { esc } from '../util.js';
import { parseImport, prepareDraft } from '../importer.js';
import { go, rerender } from '../ui.js';
import { box } from './draftbox.js';

export function render() {
  return (
    '<header class="bar"><h1>取り込み</h1></header>' +
    '<p>Claudeが作ったデータを1ラウンド分貼り付けてください。</p>' +
    `<textarea id="paste" rows="9" placeholder="ここに貼り付け" autocomplete="off" autocapitalize="off" spellcheck="false">${esc(box.text)}</textarea>` +
    (box.error ? `<p class="err" role="alert">${esc(box.error)}</p>` : '') +
    '<button class="btn wide" data-act="paste">クリップボードから貼り付け</button>' +
    `<button class="btn primary wide" data-act="next" ${box.text.trim() ? '' : 'disabled'}>確認画面へ</button>`
  );
}

export function onInput(e) {
  if (e.target.id !== 'paste') return;
  box.text = e.target.value;
  const b = document.querySelector('[data-act="next"]');
  if (b) b.disabled = !box.text.trim();
}

export async function onClick(e) {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'paste') {
    try {
      box.text = await navigator.clipboard.readText();
      box.error = '';
    } catch {
      box.error = 'ボタンでは貼り付けできませんでした。欄を長押しして貼り付けてください。';
    }
    return rerender();
  }
  if (act === 'next') {
    try {
      box.draft = prepareDraft(getState(), parseImport(box.text));
      box.error = '';
      go('#/confirm');
    } catch (err) {
      box.draft = null;
      box.error =
        err && err.code === 'newer'
          ? err.message
          : `データを読み込めませんでした。${(err && err.message) || '形式が正しくありません'}。Claudeに作り直してもらってください。`;
      rerender();
    }
  }
}
