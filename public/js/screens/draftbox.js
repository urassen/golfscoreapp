// 取り込みの貼り付け内容と下書き。取り込み画面と確認画面で共有する。
export const box = { text: '', error: '', draft: null };

export function clearBox() {
  box.text = '';
  box.error = '';
  box.draft = null;
}
