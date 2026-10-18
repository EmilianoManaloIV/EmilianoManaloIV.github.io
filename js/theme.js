// Runs in <head> before first paint so a saved theme never flashes the wrong colors.
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  try {
    var saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
  } catch (e) {
    // Storage can be blocked; the system setting still applies.
  }
})();
