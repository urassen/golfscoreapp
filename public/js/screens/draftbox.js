// 取り込みの貼り付け内容と下書き。取り込み画面・確認画面・まとめて確認の画面で共有する。
// draft: 1ラウンドだけのときの下書き。batch: まとめ取り込みのときの [{ draft } | { error }]。
export const box = { text: '', error: '', draft: null, batch: null };

export function clearBox() {
  box.text = '';
  box.error = '';
  box.draft = null;
  box.batch = null;
}
