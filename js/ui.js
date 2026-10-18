// Interaction aids for conference visitors; see ADR 0003. No network use.
import { talkStatus, formatCountdown } from "./status.js";

// == Wayfinding: mark the section being read in the nav, rail, and phone bar

const navLinks = [...document.querySelectorAll("#site-nav a, .section-rail a")];
const bar = document.querySelector("[data-section-bar]");
const barLabel = document.querySelector("[data-section-label]");
const sectionIds = ["home", "about", "projects", "research", "talk", "contact"];
const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);

let currentId = "";
function setCurrent(id) {
  if (id === currentId) return;
  currentId = id;
  for (const link of navLinks) {
    if (link.hash === `#${id}`) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  }
  barLabel.textContent = `${String(sectionIds.indexOf(id)).padStart(2, "0")} / ${id[0].toUpperCase()}${id.slice(1)}`;
}

// Current = the last section whose top has passed 40% of the screen. Unnamed panels
// (banner, values) count as the section above them, so there are no gaps; the
// page bottom always means the last section, even if it is short.
// Six rect reads per scroll event is cheap; browsers already pace scroll events.
function updateCurrent() {
  let id = sectionIds[0];
  for (const section of sections) if (section.getBoundingClientRect().top <= innerHeight * 0.4) id = section.id;
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) id = sections.at(-1).id;
  setCurrent(id);
  // The phone bar appears only once the hero has scrolled away above the screen.
  bar.classList.toggle("is-visible", sections[0].getBoundingClientRect().bottom < 0);
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

// == Talk status chip: TBA, upcoming with a countdown, live, or ended

const talk = document.querySelector("[data-talk]");
const chip = document.querySelector("[data-talk-chip]");
const local = document.querySelector("[data-talk-local]");
const labels = { tba: "Schedule TBA", live: "Live now", ended: "Ended" };

function showTalk() {
  const start = Date.parse(talk.dataset.start);
  // data-end is optional and defaults to a one-hour slot.
  const end = Date.parse(talk.dataset.end) || start + 3600000;
  const now = talkStatus(Date.now(), start, end);
  chip.dataset.state = now.state;
  chip.textContent = now.state === "upcoming" ? `Upcoming · ${formatCountdown(now.ms)}` : labels[now.state];
  // The start with its date and zone, in the visitor's own time zone, for travelers.
  const when = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  local.textContent = now.state === "tba" ? "" : new Date(start).toLocaleString([], when);
  // Minute updates, aligned to the clock; no live region, so readers aren't interrupted.
  setTimeout(showTalk, 60000 - (Date.now() % 60000));
}

if (talk && chip && local) showTalk();

// This module's controls show only once it has run, independent of main.js.
document.documentElement.classList.add("ui-ready");
