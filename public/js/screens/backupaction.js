// 「バックアップする」の操作(ホームの帯とバックアップ・リストア画面で共通)。
// 共有シートを開くため、ボタンを押した操作の中で、待たずに呼ぶこと。
import { getState, updateSettings } from '../store.js';
import { makeBackup } from '../backup.js';
import { fmtDateTime } from '../util.js';
import { toast } from '../ui.js';

/** 戻り値: { ok: true } / { ok: false, cancelled: true } / { ok: false, error: 文 } */
export async function shareBackup() {
  const now = new Date();
  const { name, text } = makeBackup(getState(), now);
  let file = null;
  try {
    file = new File([text], name, { type: 'application/json' });
  } catch {
    file = null;
  }
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'ゴルフスコアのバックアップ' });
      return done(now);
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, cancelled: true };
    // 共有できなかったときは、ダウンロードに切り替える。
  }
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    return done(now);
  } catch {
    return { ok: false, error: 'バックアップできませんでした。もう一度押してください。' };
  }
}

function done(now) {
  try {
    updateSettings({ lastBackupAt: now.toISOString() });
  } catch {
    // ファイルは渡せているので、日時を残せなくても止めない。
  }
  toast(`バックアップしました(${fmtDateTime(now.toISOString())})`);
  return { ok: true };
}
