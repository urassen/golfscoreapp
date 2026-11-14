// バックアップ・リストア: 最終バックアップの日時、バックアップする、ファイルを選んで戻す、復元を取り消す。
import { backupStale, getBlocked, getSettings, getState, hasRollback, restore, undoRestore } from '../store.js';
import { readBackup } from '../backup.js';
import { esc, fmtDateTime } from '../util.js';
import { dialog, rerender, toast } from '../ui.js';
import { shareBackup } from './backupaction.js';

let msg = { backup: '', restore: '' };

export function enter() {
  msg = { backup: '', restore: '' };
}

export function render() {
  const blocked = getBlocked();
  const last = getSettings().lastBackupAt;
  const stale = !blocked && backupStale();
  const back = blocked ? '<a class="back" href="#/home">‹戻る</a>' : '<a class="back" href="#/settings">‹設定</a>';
  return (
    `<header class="bar">${back}<h1>バックアップ・リストア</h1><span class="act"></span></header>` +
    '<section class="card"><h2>■ 状態</h2>' +
    `<p>最終バックアップ <b>${last ? esc(fmtDateTime(last)) : 'まだバックアップしていません'}</b>${
      stale && last ? ' <span class="warn">古い</span>' : ''
    }</p></section>` +
    '<section class="card"><h2>■ バックアップ</h2>' +
    '<p class="note">全データを1つのファイルにします。開いた画面の「"ファイル"に保存」から、Googleドライブなどを選んで保存してください。</p>' +
    `<button class="btn primary wide" data-act="backup" ${blocked ? 'disabled' : ''}>バックアップする</button>` +
    (msg.backup ? `<p class="err" role="alert">${esc(msg.backup)}</p>` : '') +
    '</section>' +
    '<section class="card"><h2>■ リストア</h2>' +
    '<p class="note">保存したバックアップのファイルを選ぶと、今の端末のデータがすべて入れ替わります。</p>' +
    '<button class="btn wide" data-act="pick">ファイルを選んで戻す</button>' +
    '<input type="file" id="restore-file" accept=".json,application/json" hidden>' +
    (msg.restore ? `<p class="err" role="alert">${esc(msg.restore)}</p>` : '') +
    (hasRollback() ? '<button class="btn wide" data-act="undo">復元を取り消す</button>' : '') +
    '</section>'
  );
}

export async function onClick(e) {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'backup') {
    msg.backup = '';
    const res = await shareBackup();
    if (!res.ok && res.error) msg.backup = res.error;
    return rerender();
  }
  if (act === 'pick') {
    msg.restore = '';
    const input = document.getElementById('restore-file');
    input.value = '';
    input.click();
    return;
  }
  if (act === 'undo') {
    const yes = await dialog({ message: '復元する前のデータに戻します。', ok: '戻す', cancel: 'やめる' });
    if (!yes) return;
    try {
      undoRestore();
      toast('復元を取り消しました');
    } catch (err) {
      await dialog({ message: (err && err.message) || '取り消せませんでした。' });
    }
    return rerender();
  }
}

export function onChange(e) {
  if (e.target.id !== 'restore-file') return;
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => confirmRestore(String(rd.result));
  rd.onerror = () => {
    msg.restore = 'ファイルを読み込めませんでした。';
    rerender();
  };
  rd.readAsText(file);
}

async function confirmRestore(text) {
  let b;
  try {
    b = readBackup(text);
  } catch (err) {
    msg.restore = (err && err.message) || 'このファイルはバックアップとして読めません。';
    return rerender();
  }
  const when = b.createdAt ? `作成 ${fmtDateTime(b.createdAt)}、` : '';
  const yes = await dialog({
    message: `このファイル(${when}ラウンド${b.rounds}件)で、今の端末のデータをすべて置き換えます。置き換え前のデータは端末内に1つ残り、「復元を取り消す」で戻せます。`,
    ok: '復元する',
    cancel: 'やめる',
  });
  if (!yes) return;
  try {
    restore(b.data);
    msg.restore = '';
    toast('復元しました。「復元を取り消す」で元に戻せます。');
  } catch (err) {
    await dialog({ message: (err && err.message) || '復元できませんでした。' });
  }
  rerender();
}
