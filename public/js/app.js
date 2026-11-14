// 起動、下のタブ、画面の切り替え(URLの # で画面を表す)。
import * as store from './store.js';
import { esc } from './util.js';
import { closeOverlay, setRerender } from './ui.js';
import * as home from './screens/home.js';
import * as history from './screens/history.js';
import * as detail from './screens/detail.js';
import * as imp from './screens/import.js';
import * as confirm from './screens/confirm.js';
import * as statsview from './screens/statsview.js';
import * as settings from './screens/settings.js';
import * as courses from './screens/courses.js';
import * as companions from './screens/companions.js';
import * as backup from './screens/backup.js';

const routes = {
  home: { tab: 'home', ...pick(home) },
  history: { tab: 'history', ...pick(history) },
  round: { tab: 'history', ...pick(detail) },
  import: { tab: 'import', ...pick(imp) },
  confirm: { tab: 'import', ...pick(confirm) },
  stats: { tab: 'stats', ...pick(statsview) },
  settings: { tab: 'settings', ...pick(settings) },
  courses: { tab: 'settings', render: courses.render },
  course: {
    tab: 'settings',
    render: courses.renderEdit,
    onClick: courses.onClickEdit,
    onInput: courses.onInputEdit,
    onChange: courses.onChangeEdit,
    enter: courses.enterEdit,
  },
  companions: { tab: 'settings', render: companions.render },
  companion: {
    tab: 'settings',
    render: companions.renderEdit,
    onClick: companions.onClickEdit,
    onInput: companions.onInputEdit,
    enter: companions.enterEdit,
  },
  backup: { tab: 'settings', ...pick(backup) },
};

function pick(m) {
  return { render: m.render, onClick: m.onClick, onInput: m.onInput, onChange: m.onChange, enter: m.enter };
}

const TABS = [
  ['home', 'ホーム'],
  ['history', '履歴'],
  ['import', '取り込み'],
  ['stats', '統計'],
  ['settings', '設定'],
];

function parse() {
  const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
  const key = routes[name] ? name : 'home';
  let a = null;
  if (arg) {
    try {
      a = decodeURIComponent(arg);
    } catch {
      a = arg;
    }
  }
  return { key, arg: a };
}

const view = document.getElementById('view');
const tabs = document.getElementById('tabs');
let current = null;
let lastHash = null;

function render() {
  const blocked = store.getBlocked();
  const parsed = parse();
  if (blocked && parsed.key !== 'backup') {
    view.innerHTML =
      `<header class="bar"><h1>ゴルフスコア</h1></header><p class="err" role="alert">${esc(blocked)}</p>` +
      '<p class="note">バックアップのファイルがあれば、そこから戻せます。</p><a class="btn wide" href="#/backup">バックアップから復元</a>';
    tabs.innerHTML = '';
    current = null;
    lastHash = location.hash;
    return;
  }
  const { key, arg } = parsed;
  const route = routes[key];
  const moved = location.hash !== lastHash;
  if (moved) {
    closeOverlay();
    route.enter?.(arg);
  }
  current = { route, arg };
  view.innerHTML = route.render(arg);
  view.className = `scr-${key}`;
  tabs.innerHTML = TABS.map(
    ([k, label]) => `<a href="#/${k}" class="${route.tab === k ? 'on' : ''}" ${route.tab === k ? 'aria-current="page"' : ''}>${label}</a>`
  ).join('');
  if (moved) window.scrollTo(0, 0);
  lastHash = location.hash;
}

view.onclick = (e) => current?.route.onClick?.(e, current.arg);
view.oninput = (e) => current?.route.onInput?.(e, current.arg);
view.onchange = (e) => current?.route.onChange?.(e, current.arg);

store.init();
setRerender(render);
window.addEventListener('hashchange', render);
render();
window.__appStarted = true;
