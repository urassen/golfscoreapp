// 統計の計算。表示のたびに計算し、保存しない。自分の分だけを集計する。
import { isNum } from './util.js';

/** 履歴の並び(新しい順)。同じ日付は、あとから登録したものを先にする。 */
export function sortedRounds(state) {
  return state.rounds
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.date < b.r.date ? 1 : a.r.date > b.r.date ? -1 : b.i - a.i))
    .map((x) => x.r);
}

/**
 * 絞り込み。
 * f.holeCount: 9 | 18
 * f.courseId: '' は全コース
 * f.period: '5' | '10' | '20' | 'all' | 'y2026' のような年
 */
export function filterRounds(state, f) {
  let rs = sortedRounds(state).filter((r) => r.holeCount === f.holeCount);
  if (f.courseId) rs = rs.filter((r) => r.courseId === f.courseId);
  const p = f.period || '10';
  if (p.startsWith('y')) rs = rs.filter((r) => r.date.startsWith(p.slice(1)));
  else if (p !== 'all') rs = rs.slice(0, Number(p));
  return rs;
}

export function yearsOf(state) {
  return [...new Set(state.rounds.map((r) => r.date.slice(0, 4)))].sort().reverse();
}

function roundLine(r) {
  let total = 0;
  let putts = 0;
  let puttKnown = true;
  let bunker = 0;
  let ob = 0;
  for (const h of r.holes) {
    total += isNum(h.strokes.self) ? h.strokes.self : 0;
    if (isNum(h.self.putt)) putts += h.self.putt;
    else puttKnown = false;
    if (isNum(h.self.bunker)) bunker += h.self.bunker;
    if (isNum(h.self.ob)) ob += h.self.ob;
  }
  return { id: r.id, date: r.date, courseId: r.courseId, total, putts: puttKnown ? putts : null, bunker, ob };
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/** rounds(新しい順でも古い順でもよい)をまとめる。lines は古い順(グラフ用)。 */
export function summarize(rounds) {
  const lines = rounds.map(roundLine).reverse();
  const totals = lines.map((l) => l.total);
  const puttTotals = lines.filter((l) => l.putts != null).map((l) => l.putts);

  const byPar = { 3: [], 4: [], 5: [] };
  const breakdown = { parOrBetter: 0, bogey: 0, double: 0, n: 0 };
  const fw = { hit: 0, n: 0 };
  const gir = { hit: 0, n: 0 };
  let threePutts = 0;

  for (const r of rounds) {
    for (const h of r.holes) {
      const s = h.strokes.self;
      if (!isNum(s) || !isNum(h.par)) continue;
      if (byPar[h.par]) byPar[h.par].push(s);
      const d = s - h.par;
      breakdown.n++;
      if (d <= 0) breakdown.parOrBetter++;
      else if (d === 1) breakdown.bogey++;
      else breakdown.double++;

      if ((h.par === 4 || h.par === 5) && h.self.direction) {
        fw.n++;
        if (h.self.direction === 'keep') fw.hit++;
      }
      if (isNum(h.self.putt)) {
        if (h.self.putt >= 3) threePutts++;
        // パーオンの推定: 打数−パット数 が パー−2 以下(罰打は引かない)。
        gir.n++;
        if (s - h.self.putt <= h.par - 2) gir.hit++;
      }
    }
  }

  return {
    count: rounds.length,
    lines,
    avg: avg(totals),
    best: totals.length ? Math.min(...totals) : null,
    puttAvg: avg(puttTotals),
    threePutts,
    parAvg: { 3: avg(byPar[3]), 4: avg(byPar[4]), 5: avg(byPar[5]) },
    breakdown,
    fw,
    gir,
  };
}

/** 「62%(45/72ホール)」の形。分母が0なら「-」。 */
export function rateText(hit, n) {
  if (!n) return '-';
  return `${Math.round((hit / n) * 100)}%(${hit}/${n}ホール)`;
}

export function num1(v) {
  return v == null ? '-' : (Math.round(v * 10) / 10).toFixed(1);
}
