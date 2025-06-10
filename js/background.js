// js/background.js

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  // Universally send a message to the content script of the active tab.
  // This will open the floating launcher on any normal webpage.
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "toggleLauncherWindow" });
  } catch (e) {
    // This catch block is important. It prevents errors from showing in the console
    // when the user clicks the icon on a page where content scripts cannot be injected,
    // such as the Chrome Web Store, about:blank, or other extension pages.
    console.log(
      "UdioSmartManager: Cannot open launcher on this special page. This is expected behavior."
    );
  }
});
