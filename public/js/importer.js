// 一括取り込みの処理(基本設計仕様書「5 一括取り込みの処理」の10段階)。
// 画面にも保存にも依存しない。state は引数で受け取る。
import { AppError, migrateImport } from './schema.js';
import { CLUBS, DIR_PAR3, DIR_PAR45, dirValid, isNum, normName, uid } from './util.js';
import { strokeTotal } from './model.js';

const posInt = (v) => (isNum(v) && Number.isInteger(v) && v > 0 ? v : null);
const nonNegInt = (v) => (isNum(v) && Number.isInteger(v) && v >= 0 ? v : null);
const SELF_NUM = ['bunker', 'ob', 'putt', 'penalty'];

function fail(code, reason) {
  return new AppError(code, reason);
}

/** 貼り付けた文字から JSON の部分を取り出す(前後の説明文や ``` を許す)。 */
function extractJson(text) {
  const s = String(text ?? '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw fail('format', '形式が正しくありません');
  try {
    return JSON.parse(s.slice(a, b + 1));
  } catch {
    throw fail('format', '形式が正しくありません');
  }
}

/**
 * 段階1〜4: 読む・種類・版・必須項目。
 * 成功すると「下書き(draft)」を返す。失敗は AppError を投げる(message が理由)。
 */
export function parseImport(text) {
  let obj = extractJson(text);
  if (obj.type === 'golf-backup') {
    throw fail('backup', 'これはバックアップのデータです(設定の「バックアップ・リストア」から戻してください)');
  }
  if (obj.type !== 'golf-round') throw fail('format', '形式が正しくありません');
  obj = migrateImport(obj);

  if (typeof obj.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(obj.date)) {
    throw fail('date', '日付がありません');
  }
  const facility = typeof obj.course?.facility === 'string' ? obj.course.facility.trim() : '';
  if (!facility) throw fail('course', 'コースがありません');
  if (!Array.isArray(obj.holes) || (obj.holes.length !== 9 && obj.holes.length !== 18)) {
    throw fail('holes', 'ホール数が正しくありません(9か18)');
  }
  if (obj.holeCount != null && obj.holeCount !== obj.holes.length) {
    throw fail('holes', 'ホール数が正しくありません(9か18)');
  }
  const srcPlayers = Array.isArray(obj.players) ? obj.players : [];
  const selfs = srcPlayers.filter((p) => p && p.self === true);
  if (selfs.length !== 1) throw fail('players', '自分のプレーヤーがありません');

  // 取り込み内の仮の id を、アプリ内のキーに置き換える。
  const keyOf = {};
  const players = [];
  let n = 0;
  for (const p of srcPlayers) {
    if (!p || typeof p.id !== 'string') throw fail('players', 'プレーヤーの形式が正しくありません');
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (p.self === true) {
      keyOf[p.id] = 'self';
      players.push({ key: 'self', name: name || '自分', self: true, sel: null });
    } else {
      if (!name) throw fail('players', '同伴者の名前がありません');
      const key = `p${++n}`;
      keyOf[p.id] = key;
      players.push({ key, name, self: false, sel: 'new' });
    }
  }
  const selfId = selfs[0].id;

  const allHoles = obj.holes.map((h, i) => {
    if (!h || typeof h !== 'object') throw fail('holes', `${i + 1}番目のホールの形式が正しくありません`);
    const check = new Set();
    const par = h.par === 3 || h.par === 4 || h.par === 5 ? h.par : null;
    const strokes = {};
    for (const p of srcPlayers) {
      const v = posInt(h.strokes?.[p.id]);
      strokes[keyOf[p.id]] = v;
      if (v == null && p.id !== selfId) check.add(`s:${keyOf[p.id]}`);
    }
    if (strokes.self == null) throw fail('strokes', `${i + 1}番目のホールの打数がありません`);

    const src = h.self && typeof h.self === 'object' ? h.self : {};
    const self = { club: null, direction: null, bunker: null, ob: null, putt: null, penalty: null };
    if (src.club != null) {
      if (CLUBS.includes(src.club)) self.club = src.club;
      else check.add('club');
    }
    if (src.direction != null) {
      const known = par == null ? [...DIR_PAR45, ...DIR_PAR3].includes(src.direction) : dirValid(par, src.direction);
      if (known) self.direction = src.direction;
      else check.add('direction');
    }
    for (const k of SELF_NUM) {
      let v = src[k];
      if (k === 'bunker' && typeof v === 'boolean') v = v ? 1 : 0;
      if (v != null) {
        if (nonNegInt(v) != null) self[k] = v;
        else check.add(k);
      }
    }
    for (const c of Array.isArray(h.check) ? h.check : []) {
      if (typeof c !== 'string') continue;
      if (c.startsWith('strokes.')) {
        const k = keyOf[c.slice(8)];
        if (k) check.add(`s:${k}`);
      } else if (c.startsWith('self.')) {
        if (c.slice(5) in self) check.add(c.slice(5));
      } else if (c === 'no' || c === 'par' || c === 'yard') {
        check.add(c);
      }
    }
    return { no: posInt(h.no) ?? i + 1, par, yard: posInt(h.yard), strokes, self, check: [...check] };
  });

  const nineCount = allHoles.length / 9;
  const srcNines = Array.isArray(obj.course.nines) ? obj.course.nines : [];
  const nines = [];
  for (let i = 0; i < nineCount; i++) nines.push(typeof srcNines[i] === 'string' ? srcNines[i].trim() : '');

  const printedTotals = {};
  for (const [id, v] of Object.entries(obj.printedTotals && typeof obj.printedTotals === 'object' ? obj.printedTotals : {})) {
    if (keyOf[id] && posInt(v) != null) printedTotals[keyOf[id]] = v;
  }

  return {
    date: obj.date,
    facility,
    nines,
    allHoles,
    holeCount: allHoles.length,
    players,
    printedTotals,
    courseSel: 'new',
    dupChoice: null,
    totalAck: false,
    mismatchAck: false,
  };
}

/** いま対象のホール(ホール数を9に直したときは前の9ホール)。 */
export function draftHoles(d) {
  return d.allHoles.slice(0, d.holeCount);
}
export function draftNines(d) {
  return d.nines.slice(0, d.holeCount / 9);
}
export function activePlayers(d) {
  return d.players.filter((p) => p.self || p.sel !== 'skip');
}

/** 段階5: コースの照合(施設名+前半の名称+後半の名称+ホール数)。 */
export function matchCourse(state, facility, nines, holeCount) {
  const f = normName(facility);
  const ns = nines.map(normName);
  return (
    state.courses.find(
      (c) =>
        c.holeCount === holeCount &&
        normName(c.facility) === f &&
        ns.every((x, i) => normName((c.nines || [])[i]) === x)
    ) || null
  );
}

/** 段階6: 同伴者の照合(名前)。 */
export function matchCompanion(state, name) {
  const n = normName(name);
  return state.companions.find((c) => normName(c.name) === n) || null;
}

/** コースのパー・ヤード数で、下書きの空欄を埋める。 */
export function applyCourseDefaults(d, course) {
  if (!course) return;
  d.allHoles.forEach((h, i) => {
    const ch = course.holes[i];
    if (!ch) return;
    if (h.par == null) h.par = ch.par ?? null;
    if (h.yard == null) h.yard = ch.yard ?? null;
  });
}

/** 段階5・6: 下書きに、コースと同伴者の照合結果を入れる。 */
export function prepareDraft(state, d) {
  const course = matchCourse(state, d.facility, draftNines(d), d.holeCount);
  d.courseSel = course ? course.id : 'new';
  applyCourseDefaults(d, course);
  for (const p of d.players) {
    if (p.self) continue;
    const c = matchCompanion(state, p.name);
    p.sel = c ? c.id : 'new';
  }
  return d;
}

export function selectedCourse(state, d) {
  return d.courseSel === 'new' ? null : state.courses.find((c) => c.id === d.courseSel) || null;
}

/** 段階7〜9: 登録を止める理由と、警告の一覧。 */
export function issues(state, d) {
  const holes = draftHoles(d);
  const active = activePlayers(d);
  const comps = active.filter((p) => !p.self);
  const activeKeys = new Set(active.map((p) => `s:${p.key}`));

  let checks = 0;
  for (const h of holes) {
    for (const f of h.check) if (!f.startsWith('s:') || activeKeys.has(f)) checks++;
  }

  const tooMany = comps.length > 3;
  const ids = comps.map((p) => (p.sel === 'new' ? `new:${normName(p.name)}` : p.sel));
  const sameCompanion = new Set(ids).size !== ids.length;
  const parMissing = holes.some((h) => h.par == null);
  const strokeMissing = holes.some((h) => active.some((p) => !isNum(h.strokes[p.key])));

  const course = selectedCourse(state, d);
  const differs =
    !!course &&
    (course.holeCount !== d.holeCount ||
      holes.some((h, i) => course.holes[i] && h.par != null && course.holes[i].par != null && course.holes[i].par !== h.par));
  const courseMismatch = differs && !d.mismatchAck;

  const dup = course
    ? state.rounds.find((r) => r.date === d.date && r.courseId === course.id && r.holeCount === d.holeCount) || null
    : null;

  const totals = [];
  if (d.holeCount === d.allHoles.length) {
    for (const p of active) {
      const printed = d.printedTotals[p.key];
      if (!isNum(printed)) continue;
      const actual = strokeTotal(holes, p.key);
      if (actual !== printed) totals.push({ key: p.key, name: p.name, printed, actual });
    }
  }
  const totalMismatch = totals.length > 0 && !d.totalAck;

  const canRegister =
    checks === 0 &&
    !tooMany &&
    !sameCompanion &&
    !parMissing &&
    !strokeMissing &&
    !courseMismatch &&
    !totalMismatch &&
    (!dup || d.dupChoice === 'overwrite' || d.dupChoice === 'add');

  return { checks, tooMany, sameCompanion, parMissing, strokeMissing, courseMismatch, dup, totals, totalMismatch, canRegister };
}

/** 「コースを直す」: 登録済みコースを、取り込みデータのパー・ヤード数に合わせる。 */
export function fixCourse(state, d) {
  const course = selectedCourse(state, d);
  if (!course) return;
  const holes = draftHoles(d);
  course.holeCount = d.holeCount;
  course.nines = (course.nines || []).slice(0, d.holeCount / 9);
  while (course.nines.length < d.holeCount / 9) course.nines.push('');
  course.holes = holes.map((h, i) => ({
    no: h.no,
    par: h.par,
    yard: h.yard ?? course.holes[i]?.yard ?? null,
  }));
}

/** 段階10: 登録する。state を書き換え、登録したラウンドの id を返す。 */
export function register(state, d) {
  const info = issues(state, d);
  if (!info.canRegister) throw new AppError('blocked', '登録できない項目が残っています');
  const holes = draftHoles(d);

  let course = selectedCourse(state, d);
  if (!course) {
    course = {
      id: uid(),
      facility: d.facility,
      nines: draftNines(d),
      holeCount: d.holeCount,
      holes: holes.map((h) => ({ no: h.no, par: h.par, yard: h.yard })),
    };
    state.courses.push(course);
  }

  const keyMap = { self: 'self' };
  const companionIds = [];
  for (const p of activePlayers(d)) {
    if (p.self) continue;
    let id = p.sel;
    if (id === 'new') {
      const c = { id: uid(), name: p.name };
      state.companions.push(c);
      id = c.id;
    }
    keyMap[p.key] = id;
    companionIds.push(id);
  }

  const round = {
    id: uid(),
    date: d.date,
    courseId: course.id,
    holeCount: d.holeCount,
    companionIds,
    holes: holes.map((h) => {
      const strokes = {};
      for (const [k, id] of Object.entries(keyMap)) strokes[id] = h.strokes[k];
      return { no: h.no, par: h.par, yard: h.yard, strokes, self: { ...h.self } };
    }),
  };

  if (info.dup && d.dupChoice === 'overwrite') {
    round.id = info.dup.id;
    const i = state.rounds.findIndex((r) => r.id === info.dup.id);
    state.rounds[i] = round;
  } else {
    state.rounds.push(round);
  }
  return round.id;
}
