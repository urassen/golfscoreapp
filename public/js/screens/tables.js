// 打数の表と自分の詳細の表(確認画面とラウンド詳細で共通)。
import { dirLabel, esc, halfLabel, isNum } from '../util.js';
import { parTotal, strokeTotal, yardTotal } from '../model.js';

const show = (v) => (v == null || v === '' ? '' : esc(v));

function scoreClass(strokes, par) {
  if (!isNum(strokes) || !isNum(par)) return '';
  const d = strokes - par;
  if (d < 0) return 'sc-under';
  if (d === 0) return 'sc-par';
  if (d === 1) return 'sc-bogey';
  return 'sc-double';
}

/**
 * vm:   { players: [{ key, name }], holes, nines }
 * opts: { editable } … true ならセルをタップして直せる
 * 要確認の印は hole.check(項目名の配列)で持つ。
 */
export function scoreTables(vm, opts = {}) {
  const halves = [];
  for (let i = 0; i < vm.holes.length; i += 9) halves.push(i);
  const ed = opts.editable ? ' ed' : '';

  const cell = (h, i, f, text, extra = '') => {
    const chk = (h.check || []).includes(f) ? ' chk' : '';
    return `<td class="${extra}${ed}${chk}" data-h="${i}" data-f="${esc(f)}">${text}</td>`;
  };

  let out = '';
  halves.forEach((start, hi) => {
    const part = vm.holes.slice(start, start + 9);
    const yd = yardTotal(part);
    let rows = '';
    part.forEach((h, k) => {
      const i = start + k;
      rows +=
        '<tr>' +
        cell(h, i, 'no', show(h.no), 'hno') +
        cell(h, i, 'par', show(h.par)) +
        cell(h, i, 'yard', isNum(h.yard) ? h.yard : '-') +
        vm.players.map((p) => cell(h, i, `s:${p.key}`, show(h.strokes[p.key]), scoreClass(h.strokes[p.key], h.par))).join('') +
        '</tr>';
    });
    rows +=
      `<tr class="sub"><td>小計</td><td>${parTotal(part)}</td><td>${yd == null ? '-' : yd}</td>` +
      vm.players.map((p) => `<td>${strokeTotal(part, p.key)}</td>`).join('') +
      '</tr>';
    if (halves.length > 1 && hi === halves.length - 1) {
      const ydAll = yardTotal(vm.holes);
      rows +=
        `<tr class="sub total"><td>合計</td><td>${parTotal(vm.holes)}</td><td>${ydAll == null ? '-' : ydAll}</td>` +
        vm.players.map((p) => `<td>${strokeTotal(vm.holes, p.key)}</td>`).join('') +
        '</tr>';
    }
    out +=
      `<section class="tbl"><h3>■ 打数 ${esc(halfLabel(vm.nines, hi))}</h3><div class="scroll"><table>` +
      `<thead><tr><th>ホ</th><th>パー</th><th>ヤード</th>${vm.players.map((p) => `<th>${esc(p.name)}</th>`).join('')}</tr></thead>` +
      `<tbody>${rows}</tbody></table></div></section>`;
  });

  halves.forEach((start, hi) => {
    const part = vm.holes.slice(start, start + 9);
    let rows = '';
    part.forEach((h, k) => {
      const i = start + k;
      rows +=
        `<tr><td class="hno">${show(h.no)}</td>` +
        cell(h, i, 'club', show(h.self.club)) +
        cell(h, i, 'direction', esc(dirLabel(h.par, h.self.direction))) +
        cell(h, i, 'bunker', show(h.self.bunker)) +
        cell(h, i, 'ob', show(h.self.ob)) +
        cell(h, i, 'putt', show(h.self.putt)) +
        cell(h, i, 'penalty', show(h.self.penalty)) +
        '</tr>';
    });
    out +=
      `<section class="tbl"><h3>■ 自分の詳細 ${esc(halfLabel(vm.nines, hi))}</h3><div class="scroll"><table>` +
      '<thead><tr><th>ホ</th><th>クラブ</th><th>方向</th><th>バ</th><th>OB</th><th>パット</th><th>ペナ</th></tr></thead>' +
      `<tbody>${rows}</tbody></table></div></section>`;
  });
  return out;
}
