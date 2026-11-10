// テスト用の取り込みデータ(数字は作ったもので、実際のスコアカードではない)。
const PARS = [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 5, 3, 4, 4, 3, 4, 5, 4];
const YARDS = [350, 150, 480, 370, 390, 165, 340, 510, 400, 360, 495, 140, 380, 410, 170, 355, 520, 395];
const ME = [5, 4, 6, 5, 6, 3, 5, 7, 5, 5, 6, 4, 4, 6, 4, 5, 6, 5]; // 91
const P2 = [4, 3, 5, 5, 5, 4, 4, 6, 5, 4, 6, 3, 5, 5, 3, 4, 6, 5]; // 82
const PUTT = [2, 2, 2, 2, 3, 1, 2, 2, 2, 2, 2, 2, 1, 3, 2, 2, 2, 2]; // 36

export function sampleImport(over = {}) {
  const holes = PARS.map((par, i) => ({
    no: (i % 9) + 1,
    par,
    yard: YARDS[i],
    strokes: { p1: ME[i], p2: P2[i] },
    self: {
      club: par === 3 ? '7i' : '1W',
      direction: par === 3 ? 'oneon' : i % 2 ? 'left' : 'keep',
      bunker: i === 4 ? 1 : 0,
      ob: i === 7 ? 1 : 0,
      putt: PUTT[i],
      penalty: 0,
    },
    check: i === 2 ? ['strokes.p1', 'self.club'] : [],
  }));
  return {
    type: 'golf-round',
    schema: 1,
    date: '2026-03-29',
    course: { facility: '木津川カントリー倶楽部【PGM】', nines: ['笠置', '木津川'] },
    holeCount: 18,
    players: [
      { id: 'p1', name: 'ウラッセン', self: true },
      { id: 'p2', name: '田中' },
    ],
    holes,
    printedTotals: { p1: 91, p2: 82 },
    ...over,
  };
}
export const TOTAL_ME = 91;
export const TOTAL_P2 = 82;
export const TOTAL_PUTT = 36;
