const buttons = document.querySelectorAll(".share-action");

for (const button of buttons) {
  button.addEventListener("click", async () => {
    const url = button.dataset.shareUrl || window.location.href;
    const title = button.dataset.shareTitle || document.title;

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      const originalText = button.textContent;
      button.textContent = "已复制链接";
      button.classList.add("share-copied");
      window.setTimeout(() => {
        button.textContent = originalText || "分享页面";
        button.classList.remove("share-copied");
      }, 1800);
    } catch {
      button.textContent = "复制失败";
      window.setTimeout(() => {
        button.textContent = "分享页面";
      }, 1800);
    }
  });
}
