// 画面共通の部品: 画面の切り替え、短い通知、確認ダイアログ、下から出る入力シート、保存。
import { esc } from './util.js';
import * as store from './store.js';

let rerenderFn = () => {};
export const setRerender = (f) => {
  rerenderFn = f;
};
export const rerender = () => rerenderFn();

export function go(hash) {
  if (location.hash === hash) rerender();
  else location.hash = hash;
}

let toastTimer = null;
/** 短い通知。画面の下に数秒出して消す。 */
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

const overlay = () => document.getElementById('overlay');

export function closeOverlay() {
  const el = overlay();
  el.className = '';
  el.innerHTML = '';
  el.onclick = null;
}

/** 確認ダイアログ。OK で true、やめるで false。cancel を渡さなければ閉じるだけ。 */
export function dialog({ message, ok = '閉じる', cancel = null, danger = false }) {
  return new Promise((resolve) => {
    const el = overlay();
    el.className = 'show center';
    el.innerHTML =
      `<div class="dialog" role="alertdialog" aria-modal="true"><p>${esc(message)}</p><div class="row">` +
      (cancel ? `<button class="btn" data-d="0">${esc(cancel)}</button>` : '') +
      `<button class="btn ${danger ? 'danger' : 'primary'}" data-d="1">${esc(ok)}</button></div></div>`;
    el.onclick = (e) => {
      const b = e.target.closest('[data-d]');
      if (!b) return;
      closeOverlay();
      resolve(b.dataset.d === '1');
    };
  });
}

/** 下から出るシート。html は呼び出し側でエスケープ済みのものを渡す。 */
export function openSheet(html, onClick) {
  const el = overlay();
  el.className = 'show bottom';
  el.innerHTML = `<div class="sheet">${html}</div>`;
  el.onclick = (e) => {
    if (e.target === el) {
      closeOverlay();
      return;
    }
    onClick(e, el.querySelector('.sheet'));
  };
  return el.querySelector('.sheet');
}

/**
 * 保存つきの変更。保存に失敗したら確認ダイアログを出し、「やり直す」で再試行する。
 * 画面の内容(取り込み結果や編集中の内容)はそのまま残る。
 */
export async function trySave(fn) {
  for (;;) {
    try {
      return { ok: true, value: store.update(fn) };
    } catch (e) {
      if (e && e.code === 'save') {
        const retry = await dialog({ message: e.message, ok: 'やり直す', cancel: '閉じる' });
        if (!retry) return { ok: false };
      } else {
        await dialog({ message: (e && e.message) || '保存できませんでした。' });
        return { ok: false };
      }
    }
  }
}
