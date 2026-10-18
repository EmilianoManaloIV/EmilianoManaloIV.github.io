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
    const here = link.pathname === location.pathname && link.hash === `#${id}`;
    if (here) link.setAttribute("aria-current", "true");
    else if (link.getAttribute("aria-current") === "true") link.removeAttribute("aria-current");
    if (here && link.closest("#site-nav")) navText = link.textContent.trim().replace(/\s+/, " / ");
  }
  // The phone bar repeats the nav's own number and name, e.g. "04 / Contact".
  if (barLabel) barLabel.textContent = navText;
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

// This module's controls show only once it has run, independent of main.js.
document.documentElement.classList.add("ui-ready");
