// 設定: 各管理画面への入口と、アプリの版。
import { APP_VERSION, esc } from '../util.js';

export function render() {
  return (
    '<header class="bar"><h1>設定</h1></header><div class="list">' +
    '<a class="item" href="#/courses"><div>コース管理</div><div>›</div></a>' +
    '<a class="item" href="#/companions"><div>同伴者管理</div><div>›</div></a>' +
    '<a class="item" href="#/backup"><div>バックアップ・リストア<br><small>この版ではまだ使えません</small></div><div>›</div></a>' +
    `</div><p class="note">アプリの版 ${esc(APP_VERSION)}</p>`
  );
}
