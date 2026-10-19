// Interaction aids for conference visitors; see ADR 0003. No network use.

// == Wayfinding: mark the section being read in the nav, rail, and phone bar.
// Sections come from the page itself, so any page with `main section[id]` works.

const navLinks = [...document.querySelectorAll("#site-nav a, .section-rail a")];
const bar = document.querySelector("[data-section-bar]");
const barLabel = document.querySelector("[data-section-label]");
const sections = [...document.querySelectorAll("main section[id]")];
let currentId = "";

function setCurrent(id) {
  if (id === currentId) return;
  currentId = id;
  let navText = "";
  for (const link of navLinks) {
    // Only same-page links: /#about on the home page, never /rd/ or /#about elsewhere.
    const here = link.pathname === location.pathname.replace(/index\.html$/, "") && link.hash === `#${id}`;
    if (here) link.setAttribute("aria-current", "true");
    else if (link.getAttribute("aria-current") === "true") link.removeAttribute("aria-current");
    if (here && link.closest("#site-nav")) navText = link.textContent.trim().replace(/\s+/, " / ");
  }
  // The phone bar repeats the nav's own number and name, e.g. "04 / Contact".
  if (barLabel) barLabel.textContent = navText;
}

// The scroll ruler's readout in the right margin on wide screens (ADR 0009):
// the reader's position, the page length, and the section number, as on a drawing.
// It is written only where the ruler shows, and only when the numbers change.
const ruler = document.querySelector("[data-ruler]");
const wide = matchMedia("(min-width: 1440px)");
const five = (n) => String(Math.max(0, Math.round(n))).padStart(5, "0");

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
  // Reads above, the one write last, so a scroll costs a single layout.
  if (!ruler || !wide.matches) return;
  const sec = String(sections.findIndex((s) => s.id === id) + 1).padStart(2, "0");
  const readout = `Y ${five(scrollY)} / ${five(document.documentElement.scrollHeight - innerHeight)} · SEC ${sec}`;
  if (ruler.textContent !== readout) ruler.textContent = readout;
}
addEventListener("scroll", updateCurrent, { passive: true });
addEventListener("resize", updateCurrent);
// Late layout changes (fonts, images, comments) change the page length too.
new ResizeObserver(updateCurrent).observe(document.body);
updateCurrent();

// == Share and copy, with one polite status line for feedback

const status = document.querySelector("[data-copy-status]");
let clearStatus = 0;

// Clear first, then set, so a repeated "Email copied" is announced again.
function announce(text) {
  status.textContent = "";
  setTimeout(() => (status.textContent = text), 50);
  clearTimeout(clearStatus);
  clearStatus = setTimeout(() => (status.textContent = ""), 3000);
}

async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    announce(`${what} copied`);
  } catch (e) {
    announce("Copy failed");
  }
}

// Share the canonical address, not localhost or a URL with a #fragment.
const pageUrl = document.querySelector('link[rel="canonical"]')?.href || location.href.split("#")[0];
document.querySelector("[data-share]")?.addEventListener("click", async () => {
  if (navigator.share) {
    try {
      await navigator.share({ title: document.title, url: pageUrl });
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // The visitor closed the share sheet.
    }
  }
  copy(pageUrl, "Link");
});

document.querySelector("[data-copy-email]")?.addEventListener("click", (e) => {
  copy(e.currentTarget.dataset.copyEmail, "Email");
});

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
