// Interaction aids for conference visitors; see ADR 0003. No network use.

// == Wayfinding: mark the section being read in the rail and phone bar. The top nav
// links whole pages and marks its own (ADR 0015). Sections come from the page
// itself, so any page with `main section[id]` and a rail works.

const railLinks = [...document.querySelectorAll(".section-rail a")];
const bar = document.querySelector("[data-section-bar]");
const barLabel = document.querySelector("[data-section-label]");
const sections = [...document.querySelectorAll("main section[id]")];
let currentId = "";

function setCurrent(id) {
  if (id === currentId) return;
  currentId = id;
  for (const link of railLinks) {
    const here = link.hash === `#${id}`;
    if (here) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
    // The phone bar names the section, as its rail dot does, e.g. "Projects".
    if (here && barLabel) barLabel.textContent = link.getAttribute("aria-label");
  }
}

// Current = the last section whose top has passed 40% of the screen. Unnamed panels
// (banner, values) count as the section above them, so there are no gaps; the
// page bottom always means the last section, even if it is short.
function updateCurrent() {
  if (!sections.length) return;
  let id = sections[0].id;
  for (const section of sections) if (section.getBoundingClientRect().top <= innerHeight * 0.4) id = section.id;
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) id = sections.at(-1).id;
  setCurrent(id);
  // The phone bar appears only once the first section has scrolled away above the screen.
  bar?.classList.toggle("is-visible", sections[0].getBoundingClientRect().bottom < 0);
}
addEventListener("scroll", updateCurrent, { passive: true });
addEventListener("resize", updateCurrent);
updateCurrent();

// == Share and copy, with a polite status line for feedback. Every page's footer has
// these (ADR 0015), and the QR card has its own, so each button reports in the
// status line beside it.

const statusFor = (button) => button.closest("section, footer")?.querySelector("[data-copy-status]");
const clearStatus = new Map();

// Clear first, then set, so a repeated "Email copied" is announced again.
function announce(status, text) {
  if (!status) return;
  status.textContent = "";
  setTimeout(() => (status.textContent = text), 50);
  clearTimeout(clearStatus.get(status));
  clearStatus.set(status, setTimeout(() => (status.textContent = ""), 3000));
}

async function copy(button, text, what) {
  try {
    await navigator.clipboard.writeText(text);
    announce(statusFor(button), `${what} copied`);
  } catch (e) {
    announce(statusFor(button), "Copy failed");
  }
}

// Share the canonical address, not localhost or a URL with a #fragment.
const pageUrl = document.querySelector('link[rel="canonical"]')?.href || location.href.split("#")[0];
for (const button of document.querySelectorAll("[data-share]")) {
  button.addEventListener("click", async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url: pageUrl });
        return;
      } catch (e) {
        if (e.name === "AbortError") return; // The visitor closed the share sheet.
      }
    }
    copy(button, pageUrl, "Link");
  });
}

for (const button of document.querySelectorAll("[data-copy-email]")) {
  button.addEventListener("click", () => copy(button, button.dataset.copyEmail, "Email"));
}

// On the 404 page, an old address /rd/<number>-<old-name>/ (or /projects/…) goes to
// /rd/<number>/, which redirects to the current name, so renamed posts and projects
// keep shared links (ADR 0005, 0006). Each old address is tried once per visit, so a
// stale cached redirect can't bounce forever.
const moved = document.getElementById("not-found") && location.pathname.match(/^\/(rd|projects)\/(\d+)-[^/]+\/?$/);
if (moved) {
  let tried = false;
  try {
    tried = sessionStorage.getItem("rd-moved") === location.pathname;
    sessionStorage.setItem("rd-moved", location.pathname);
  } catch (e) {
    // Without storage the redirect still runs; the browser stops a real loop on its own.
  }
  if (!tried) location.replace(`/${moved[1]}/${moved[2]}/`);
}

// This module's controls show only once it has run, independent of main.js.
document.documentElement.classList.add("ui-ready");
