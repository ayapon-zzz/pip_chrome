// PiP中の動画が「終了・破棄・一時停止」され、別の動画が再生を始めたら、
// PiPウィンドウを新しい動画へ引き継ぐ。
//
// requestPictureInPicture() は通常ユーザー操作が必要だが、すでにPiP中の要素が
// ある間は操作なしで別の動画へ切り替えられる。そのため、古い動画のPiPウィンドウが
// 残っているうちに新しい動画へ切り替える。
(() => {
  'use strict';

  const LOG_PREFIX = '[U-NEXT PiP Keeper]';
  // 作品一覧のプレビュー動画などへ切り替わらないよう、短い動画は対象外にする
  const MIN_DURATION_SEC = 60;
  const RETRY_INTERVAL_MS = 1000;

  let pipVideo = null; // 現在PiP中の動画（DOMから外れていても保持する）
  let switching = false;
  let nextAttemptAt = 0;
  const tracked = new WeakSet();

  const isDead = (v) => !v.isConnected || v.ended || v.readyState === 0;
  const isPlaying = (v) => !v.paused && !v.ended && v.readyState >= 2;

  function isCandidate(v) {
    if (!(v instanceof HTMLVideoElement) || v === pipVideo) return false;
    if (!v.isConnected || !isPlaying(v) || v.videoWidth === 0) return false;
    // duration が NaN / Infinity の場合は通す
    return !(v.duration < MIN_DURATION_SEC);
  }

  function findCandidate(hint) {
    const videos = new Set(document.querySelectorAll('video'));
    if (hint) videos.add(hint);
    let best = null;
    let bestArea = -1;
    for (const v of videos) {
      if (!isCandidate(v)) continue;
      const area = v.clientWidth * v.clientHeight;
      if (area > bestArea) {
        best = v;
        bestArea = area;
      }
    }
    return best;
  }

  async function evaluate(hint) {
    if (!pipVideo || switching) return;
    // PiP中の動画がまだ再生されているなら何もしない
    if (!isDead(pipVideo) && !pipVideo.paused) return;
    if (Date.now() < nextAttemptAt) return;

    const next = findCandidate(hint);
    if (!next) return;

    switching = true;
    try {
      next.disablePictureInPicture = false;
      await next.requestPictureInPicture();
      setPipVideo(next);
      console.debug(LOG_PREFIX, 'PiPを次の動画へ引き継ぎました');
    } catch (e) {
      nextAttemptAt = Date.now() + RETRY_INTERVAL_MS;
      console.warn(LOG_PREFIX, 'PiPの引き継ぎに失敗しました:', e);
    } finally {
      switching = false;
    }
  }

  function setPipVideo(v) {
    pipVideo = v;
    if (tracked.has(v)) return;
    tracked.add(v);
    // DOMから外れた要素のイベントは document まで届かないので直接監視する
    v.addEventListener('leavepictureinpicture', () => {
      if (pipVideo === v) pipVideo = null;
    });
    for (const type of ['ended', 'emptied', 'pause']) {
      v.addEventListener(type, () => evaluate());
    }
  }

  const videoOf = (e) => {
    const target = e.composedPath()[0] ?? e.target;
    return target instanceof HTMLVideoElement ? target : null;
  };

  document.addEventListener(
    'enterpictureinpicture',
    (e) => {
      const v = videoOf(e);
      if (v) setPipVideo(v);
    },
    true
  );

  // メディアイベントはバブリングしないのでキャプチャで拾う
  for (const type of ['loadeddata', 'canplay', 'playing', 'timeupdate']) {
    document.addEventListener(
      type,
      (e) => {
        if (!pipVideo) return;
        const v = videoOf(e);
        if (v) evaluate(v);
      },
      true
    );
  }

  if (document.pictureInPictureElement instanceof HTMLVideoElement) {
    setPipVideo(document.pictureInPictureElement);
  }
})();
