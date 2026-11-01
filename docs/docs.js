"use strict";
/* SecondNurse Docs shell: TOC build, nav collapse, search filter, theme, mobile nav. */

/* theme */
const root = document.documentElement;
const saved = localStorage.getItem("sn-docs-theme");
if (saved) root.dataset.theme = saved;
document.querySelector("#theme-toggle").addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "" : "dark";
  if (next) root.dataset.theme = next; else delete root.dataset.theme;
  localStorage.setItem("sn-docs-theme", next);
});

/* collapsible nav groups */
document.querySelectorAll(".nav-group-head").forEach(head => {
  head.addEventListener("click", () => {
    const group = head.closest(".nav-group");
    group.classList.toggle("is-closed");
    head.setAttribute("aria-expanded", String(!group.classList.contains("is-closed")));
  });
});

/* search: filter sidebar items by label */
const searchInput = document.querySelector("#nav-search");
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("is-hidden", !!q && !item.textContent.toLowerCase().includes(q));
  });
  document.querySelectorAll(".nav-group").forEach(g => {
    if (q) g.classList.remove("is-closed");
  });
});

/* right TOC from h2/h3 + scrollspy */
const toc = document.querySelector("#toc");
const heads = [...document.querySelectorAll(".content h2, .content h3")];
heads.forEach((h, i) => {
  if (!h.id) h.id = `s-${i}-${h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;
  const a = document.createElement("a");
  a.href = `#${h.id}`;
  a.textContent = h.textContent;
  if (h.tagName === "H3") a.className = "sub";
  toc.append(a);
});
const tocLinks = [...toc.querySelectorAll("a")];
const spy = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      tocLinks.forEach(a => a.classList.toggle("is-active", a.getAttribute("href") === `#${e.target.id}`));
    }
  });
}, { rootMargin: "-20% 0px -70% 0px" });
heads.forEach(h => spy.observe(h));

/* mobile nav */
document.querySelector("#menu-toggle").addEventListener("click", () => {
  document.body.classList.toggle("nav-open");
});
