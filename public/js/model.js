// ホールの値の読み書きと合計。画面にも保存にも依存しない。
import { isNum, dirValid } from './util.js';

/**
 * field の種類:
 *  'no' 'par' 'yard'            … ホールの項目
 *  's:<プレーヤーのキー>'        … 打数
 *  'club' 'direction' 'bunker' 'ob' 'putt' 'penalty' … 自分の項目
 */
export function getField(hole, field) {
  if (field === 'no' || field === 'par' || field === 'yard') return hole[field] ?? null;
  if (field.startsWith('s:')) return hole.strokes[field.slice(2)] ?? null;
  return hole.self[field] ?? null;
}

export function setField(hole, field, value) {
  if (field === 'no' || field === 'par' || field === 'yard') {
    hole[field] = value;
    // パーを変えて方向の値が合わなくなったら、方向を空欄に戻す。
    if (field === 'par' && !dirValid(value, hole.self.direction)) hole.self.direction = null;
  } else if (field.startsWith('s:')) {
    hole.strokes[field.slice(2)] = value;
  } else {
    hole.self[field] = value;
  }
}

export function strokeTotal(holes, key) {
  let t = 0;
  for (const h of holes) {
    const v = h.strokes[key];
    if (isNum(v)) t += v;
  }
  return t;
}

export function parTotal(holes) {
  let t = 0;
  for (const h of holes) if (isNum(h.par)) t += h.par;
  return t;
}

/** ヤード数の合計。1つでも未入力なら null。 */
export function yardTotal(holes) {
  let t = 0;
  for (const h of holes) {
    if (!isNum(h.yard)) return null;
    t += h.yard;
  }
  return t;
}

export function emptySelf() {
  return { club: null, direction: null, bunker: null, ob: null, putt: null, penalty: null };
}
