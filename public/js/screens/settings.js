// 設定: 各管理画面への入口と、アプリの版。
import { APP_VERSION, esc, fmtDateTime } from '../util.js';
import { backupStale, getSettings } from '../store.js';

export function render() {
  const last = getSettings().lastBackupAt;
  const sub = last ? `最終バックアップ ${esc(fmtDateTime(last))}` : 'まだバックアップしていません';
  return (
    '<header class="bar"><h1>設定</h1></header><div class="list">' +
    '<a class="item" href="#/courses"><div>コース管理</div><div>›</div></a>' +
    '<a class="item" href="#/companions"><div>同伴者管理</div><div>›</div></a>' +
    `<a class="item" href="#/backup"><div>バックアップ・リストア<br><small>${sub}${backupStale() && last ? ' <span class="warn">古い</span>' : ''}</small></div><div>›</div></a>` +
    `</div><p class="note">アプリの版 ${esc(APP_VERSION)}</p>`
  );
}
