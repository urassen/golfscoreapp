// SVG のグラフ(積み上げ棒・帯グラフ・棒)。数字だけを受け取り、SVG の文字列を返す。
// 受け取る値はすべて数値なので、文字列の埋め込みによる危険はない。

const n2 = (v) => Math.round(v * 100) / 100;

/**
 * 合計スコアの推移(積み上げ棒)。items: [{ total, putts|null }](古い順)
 * 下にパット、上にそれ以外。パット不明のラウンドは合計だけの薄い棒。
 * avgTotal / avgPutt があれば、平均の横線を引く(mini では数字なし)。
 * mini でなく棒が十分に太いときは、棒の中にパットとそれ以外の数を出す。
 */
export function stackedBars(items, { mini = false, avgTotal = null, avgPutt = null } = {}) {
  const W = 320;
  const H = mini ? 64 : 180;
  const top = mini ? 4 : 18;
  const bottom = 4;
  const n = items.length;
  const max = Math.max(1, ...items.map((i) => i.total));
  const hasAvg = avgTotal != null || avgPutt != null;
  const gutter = !mini && hasAvg ? 34 : 0; // 右に平均の数字を出す余白
  const PW = W - gutter;
  const slot = PW / n;
  const bw = Math.min(30, slot * 0.62);
  const scale = (H - top - bottom) / max;
  const inner = !mini && bw >= 14; // 棒の中の数字を出せる太さか
  const small = slot < 18 ? ' small' : ''; // 棒が多いときは上の数字を小さく
  const yOf = (v) => n2(H - bottom - v * scale);
  let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="合計スコアの推移">`;
  items.forEach((it, i) => {
    const x = n2(slot * i + (slot - bw) / 2);
    const cx = n2(x + bw / 2);
    const hT = n2(it.total * scale);
    const yT = n2(H - bottom - hT);
    if (it.putts == null) {
      out += `<rect class="c-unknown" x="${x}" y="${yT}" width="${n2(bw)}" height="${hT}" rx="2"/>`;
    } else {
      const hP = n2(it.putts * scale);
      const hO = n2(hT - hP);
      out += `<rect class="c-other" x="${x}" y="${yT}" width="${n2(bw)}" height="${hO}" rx="2"/>`;
      out += `<rect class="c-putt" x="${x}" y="${n2(H - bottom - hP)}" width="${n2(bw)}" height="${hP}"/>`;
      if (inner && hO >= 13) {
        out += `<text class="c-in-other" x="${cx}" y="${n2(yT + hO / 2 + 3.5)}" text-anchor="middle">${it.total - it.putts}</text>`;
      }
      if (inner && hP >= 13) {
        out += `<text class="c-in-putt" x="${cx}" y="${n2(H - bottom - hP / 2 + 3.5)}" text-anchor="middle">${it.putts}</text>`;
      }
    }
    if (!mini) {
      out += `<text class="c-label${small}" x="${cx}" y="${n2(yT - 4)}" text-anchor="middle">${it.total}</text>`;
    }
  });
  // 平均の横線(棒の上に重ねる)
  const line = (v, cls, label) => {
    if (v == null || !Number.isFinite(v)) return;
    const y = yOf(v);
    out += `<line class="${cls}" x1="0" y1="${y}" x2="${PW}" y2="${y}"/>`;
    if (!mini) {
      out += `<text class="c-avg-label ${cls}-t" x="${W - 1}" y="${n2(y + 3.5)}" text-anchor="end" aria-label="${label}">${(Math.round(v * 10) / 10).toFixed(1)}</text>`;
    }
  };
  line(avgTotal, 'c-avg', '平均');
  line(avgPutt, 'c-pavg', 'パット');
  if (!mini) {
    items.forEach((_, i) => {
      out += `<rect class="c-hit" data-i="${i}" x="${n2(slot * i)}" y="0" width="${n2(slot)}" height="${H}"/>`;
    });
  }
  return out + '</svg>';
}

/** 2系列の棒グラフ(バンカー・OBの回数の推移)。items: [{ a, b }](古い順) */
export function pairBars(items) {
  const W = 320;
  const H = 110;
  const top = 16;
  const bottom = 4;
  const n = items.length;
  const max = Math.max(1, ...items.map((i) => Math.max(i.a, i.b)));
  const slot = W / n;
  const bw = Math.min(14, slot * 0.3);
  const scale = (H - top - bottom) / max;
  let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="バンカー・OBの回数の推移">`;
  items.forEach((it, i) => {
    const cx = slot * i + slot / 2;
    [
      ['c-bunker', it.a, cx - bw - 1],
      ['c-ob', it.b, cx + 1],
    ].forEach(([cls, v, x]) => {
      const h = n2(v * scale);
      const y = n2(H - bottom - h);
      out += `<rect class="${cls}" x="${n2(x)}" y="${y}" width="${n2(bw)}" height="${Math.max(h, 1)}" rx="1.5"/>`;
      out += `<text class="c-label" x="${n2(x + bw / 2)}" y="${n2(y - 3)}" text-anchor="middle">${v}</text>`;
    });
    out += `<rect class="c-hit" data-i="${i}" x="${n2(slot * i)}" y="0" width="${n2(slot)}" height="${H}"/>`;
  });
  return out + '</svg>';
}

/** 内訳の帯グラフ(横1本)。parts: [{ cls, value }] */
export function bandBar(parts) {
  const W = 320;
  const H = 22;
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  let x = 0;
  let out = `<svg class="chart bandbar" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="内訳">`;
  for (const p of parts) {
    const w = n2((p.value / total) * W);
    if (w > 0) out += `<rect class="${p.cls}" x="${n2(x)}" y="0" width="${w}" height="${H}"/>`;
    x += w;
  }
  return out + '</svg>';
}
