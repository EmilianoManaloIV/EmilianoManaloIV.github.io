// Interaction aids for conference visitors (ADR 0003): where am I on the page,
// share or copy contact details fast, and is the talk on yet. No network use:
// Share and Clipboard are local OS features. The page works without this file.
import { talkStatus, formatCountdown } from "./status.js";

// == Wayfinding: mark the section being read in the nav, rail, and phone bar

const navLinks = [...document.querySelectorAll("#site-nav a, .section-rail a")];
const bar = document.querySelector("[data-section-bar]");
const barLabel = document.querySelector("[data-section-label]");
const sectionIds = ["home", "about", "projects", "research", "talk", "contact"];
const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
const names = { home: "Home", about: "About", projects: "Projects", research: "Research", talk: "Talk", contact: "Contact" };

function setCurrent(id) {
  for (const link of navLinks) {
    if (link.hash === `#${id}`) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  }
  const label = `${String(sectionIds.indexOf(id)).padStart(2, "0")} / ${names[id]}`;
  barLabel.textContent = label;
  bar.setAttribute("aria-label", `${label}. Back to menu`);
}

// A thin band across the middle of the screen decides which section is "current".
const reading = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) if (entry.isIntersecting) setCurrent(entry.target.id);
  },
  { rootMargin: "-45% 0px -50% 0px" },
);
for (const section of sections) reading.observe(section);

// The phone bar appears only once the hero has scrolled away above the screen.
const hero = document.getElementById("home");
new IntersectionObserver(([entry]) => {
  bar.classList.toggle("is-visible", !entry.isIntersecting && entry.boundingClientRect.top < 0);
}).observe(hero);

// == Share and copy, with one polite status line for feedback

const status = document.querySelector("[data-copy-status]");
let clearStatus = 0;

function announce(text) {
  status.textContent = text;
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

// == Talk status chip: TBA, upcoming with a countdown, live, or ended

const talk = document.querySelector("[data-talk]");
const chip = document.querySelector("[data-talk-chip]");
const local = document.querySelector("[data-talk-local]");
const labels = { tba: "Schedule TBA", live: "Live now", ended: "Ended" };

function showTalk() {
  const start = Date.parse(talk.dataset.start);
  const end = Date.parse(talk.dataset.end);
  const now = talkStatus(Date.now(), start, end);
  chip.dataset.state = now.state;
  chip.textContent = now.state === "upcoming" ? `Upcoming · ${formatCountdown(now.ms)}` : labels[now.state];
  // The start in the visitor's own time zone, for travelers.
  local.textContent =
    now.state === "tba"
      ? ""
      : `${new Date(start).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })} your time`;
  // Minute updates, aligned to the clock; no live region, so readers aren't interrupted.
  setTimeout(showTalk, 60000 - (Date.now() % 60000));
}

if (talk && chip && local) showTalk();
