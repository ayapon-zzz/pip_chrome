// ページ側（MAIN world）で実行される。
// サイトのスクリプトがエピソード切り替え時に exitPictureInPicture() を呼ぶと
// PiPウィンドウが閉じてしまい、ユーザー操作なしでは再度開けなくなる。
// ユーザー操作を伴わない呼び出しだけを無視して、PiPウィンドウを維持する。
(() => {
  'use strict';

  const original = Document.prototype.exitPictureInPicture;
  if (typeof original !== 'function') return;

  Document.prototype.exitPictureInPicture = function () {
    if (navigator.userActivation?.isActive) {
      return original.call(this);
    }
    console.debug('[U-NEXT PiP Keeper]', 'ユーザー操作のない exitPictureInPicture() を無視しました');
    return Promise.resolve();
  };
})();
