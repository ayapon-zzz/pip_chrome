const statusElement = document.getElementById("status");
const togglePipButton = document.getElementById("togglePipButton");

function setStatus(text) {
  statusElement.textContent = text;
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function togglePictureInPicture() {
  setStatus("");
  const tabId = await getActiveTabId();
  if (!tabId) {
    setStatus("アクティブなタブを取得できませんでした。");
    return;
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      const video = document.querySelector("video");
      if (!video) {
        return { ok: false, reason: "no_video" };
      }

      try {
        if (document.pictureInPictureElement === video) {
          await document.exitPictureInPicture();
          return { ok: true, action: "exited" };
        }

        await video.requestPictureInPicture();
        return { ok: true, action: "entered" };
      } catch (error) {
        return {
          ok: false,
          reason: "pip_error",
          message: error instanceof Error ? error.message : "Unknown error"
        };
      }
    }
  });

  const injectedResult = result?.result;
  if (!injectedResult) {
    setStatus("処理結果を取得できませんでした。");
    return;
  }

  if (injectedResult.ok && injectedResult.action === "entered") {
    setStatus("ピクチャインピクチャを開始しました。");
    return;
  }

  if (injectedResult.ok && injectedResult.action === "exited") {
    setStatus("ピクチャインピクチャを終了しました。");
    return;
  }

  if (injectedResult.reason === "no_video") {
    setStatus("このページに動画要素が見つかりません。");
    return;
  }

  setStatus(`PiP の切り替えに失敗しました: ${injectedResult.message ?? "不明なエラー"}`);
}

togglePipButton.addEventListener("click", () => {
  togglePictureInPicture().catch((error) => {
    setStatus(`エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`);
  });
});
