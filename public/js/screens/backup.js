// バックアップ・リストア。版0.1.0では未対応(段階2・版0.2.0で入れる)。
export function render() {
  return (
    '<header class="bar"><a class="back" href="#/settings">‹設定</a><h1>バックアップ・リストア</h1></header>' +
    '<p class="note">Googleドライブへのバックアップとリストアは、次の版(0.2.0)で入ります。</p>' +
    '<p class="note">この版のデータは、この端末のこのブラウザの中だけに保存されます。確認用として使ってください。</p>'
  );
}
