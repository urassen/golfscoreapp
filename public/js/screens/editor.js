// セルをタップしたときの入力シート(大きな＋/－ボタン、選択ボタン)。
import { CLUBS, dirChoices, dirLabel, esc, isNum } from '../util.js';
import { closeOverlay, openSheet } from '../ui.js';

const STEP = {
  no: { min: 1, start: 1 },
  bunker: { min: 0, start: 0 },
  ob: { min: 0, start: 0 },
  putt: { min: 0, start: 2 },
  penalty: { min: 0, start: 0 },
};
const SELF_FIELDS = ['club', 'direction', 'bunker', 'ob', 'putt', 'penalty'];

/**
 * o.title    見出し(例: 「3番 自分の打数」)
 * o.field    項目(model.js の field)
 * o.par      そのホールのパー
 * o.value    今の値
 * o.checked  要確認の印が付いているか
 * o.onSave(value)  値を決めたとき(要確認の印は呼び出し側で外す)
 * o.onConfirm()    「確認済み」を押したとき
 */
export function openEditor(o) {
  const f = o.field;
  const isStroke = f.startsWith('s:');
  const allowEmpty = SELF_FIELDS.includes(f) || f === 'yard';
  let body = '';
  let cur = o.value;

  if (f === 'par') {
    body = `<div class="choices">${[3, 4, 5]
      .map((v) => `<button class="btn big ${v === cur ? 'on' : ''}" data-v="${v}">${v}</button>`)
      .join('')}</div>`;
  } else if (f === 'club') {
    body = `<div class="choices clubs">${CLUBS.map(
      (v) => `<button class="btn ${v === cur ? 'on' : ''}" data-v="${esc(v)}">${esc(v)}</button>`
    ).join('')}</div>`;
  } else if (f === 'direction') {
    body = `<div class="choices">${dirChoices(o.par)
      .map((v) => `<button class="btn ${v === cur ? 'on' : ''}" data-v="${esc(v)}">${esc(dirLabel(o.par, v))}</button>`)
      .join('')}</div>`;
  } else if (f === 'yard') {
    body = `<div class="yard"><input id="ed-yard" type="number" inputmode="numeric" min="1" max="999" value="${
      isNum(cur) ? cur : ''
    }"><span>ヤード</span></div><button class="btn primary wide" data-ok="1">決定</button>`;
  } else {
    const st = isStroke ? { min: 1, start: isNum(o.par) ? o.par : 4 } : STEP[f];
    if (!isNum(cur)) cur = st.start;
    body =
      `<div class="stepper"><button class="btn step" data-step="-1" aria-label="減らす">－</button>` +
      `<output id="ed-val">${cur}</output>` +
      `<button class="btn step" data-step="1" aria-label="増やす">＋</button></div>` +
      `<button class="btn primary wide" data-ok="1">決定</button>`;
    o._min = st.min;
  }

  const extra =
    (o.checked && o.value != null ? `<button class="btn" data-confirm="1">確認済みにする</button>` : '') +
    (allowEmpty ? `<button class="btn" data-empty="1">空欄にする</button>` : '') +
    `<button class="btn" data-close="1">閉じる</button>`;

  openSheet(
    `<h3>${esc(o.title)}</h3>${o.checked ? '<p class="note chk-note">要確認の箇所です。</p>' : ''}${body}<div class="row wrap">${extra}</div>`,
    (e, sheet) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.close) return closeOverlay();
      if (b.dataset.empty) {
        closeOverlay();
        return o.onSave(null);
      }
      if (b.dataset.confirm) {
        closeOverlay();
        return o.onConfirm();
      }
      if (b.dataset.step) {
        cur = Math.max(o._min, Math.min(99, cur + Number(b.dataset.step)));
        sheet.querySelector('#ed-val').textContent = cur;
        return;
      }
      if (b.dataset.ok) {
        if (f === 'yard') {
          const v = Number(sheet.querySelector('#ed-yard').value);
          if (!Number.isInteger(v) || v < 1) return;
          cur = v;
        }
        closeOverlay();
        return o.onSave(cur);
      }
      if (b.dataset.v != null) {
        closeOverlay();
        return o.onSave(f === 'par' ? Number(b.dataset.v) : b.dataset.v);
      }
    }
  );
}

const FIELD_NAME = {
  no: 'ホール番号',
  par: 'パー',
  yard: 'ヤード数',
  club: 'ティークラブ',
  direction: '方向',
  bunker: 'バンカー',
  ob: 'OB',
  putt: 'パット数',
  penalty: 'ペナルティ',
};

export function editorTitle(hole, field, players) {
  if (field.startsWith('s:')) {
    const p = players.find((x) => x.key === field.slice(2));
    return `${hole.no}番 ${p ? p.name : ''}の打数`;
  }
  return `${hole.no}番 ${FIELD_NAME[field] || ''}`;
}
