/* ============================================================
   SHARED HELPERS
   Every page imports from this file so we never repeat code.
   ============================================================ */

import { IS_CONFIGURED, CURRENCY } from "./config.js";

/* ---------- 1. Safety: escape text before putting it in the page ---------- */
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* ---------- 2. Dates ---------- */
export function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Turns "2026-03-08" into "08 Mar 2026". */
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return escapeHtml(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Whole days between two YYYY-MM-DD dates (later - earlier). */
export function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr + "T00:00:00");
  const b = new Date(toStr + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

export function money(amount) {
  return `${CURRENCY} ${Number(amount || 0).toFixed(2)}`;
}

/* ---------- 3. Toast notifications ---------- */
export function toast(message, type = "info") {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.setAttribute("role", "status");
  el.innerHTML = escapeHtml(message);
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

/** Turns a Supabase error into something a student can understand. */
export function friendlyError(error) {
  const msg = (error && (error.message || error.hint)) || "Something went wrong.";
  if (msg.includes("duplicate key")) {
    if (msg.includes("isbn")) return "That ISBN already exists. Every book needs a unique ISBN.";
    if (msg.includes("admission_no")) return "That admission number is already used by another student.";
    return "That record already exists.";
  }
  if (msg.includes("violates foreign key")) {
    return "This record is linked to borrowing history, so it cannot be removed.";
  }
  if (msg.includes("copies_check")) return "No copies of this book are available right now.";
  if (msg.includes("Failed to fetch")) {
    return "Cannot reach the database. Check your internet connection and the keys in js/config.js.";
  }
  return msg;
}

/* ---------- 4. Modals ---------- */
export function openModal(id) {
  document.getElementById(id).classList.add("open");
}
export function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}
/** Clicking the dim backdrop or the X closes the modal. */
export function wireModal(id) {
  const modal = document.getElementById(id);
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.dataset.close === "true") closeModal(id);
  });
}

/* ---------- 5. Loading + empty states ---------- */
export function showSpinner(container) {
  container.innerHTML = `<div class="spinner-box"><div class="spinner" aria-label="Loading"></div></div>`;
}
export function emptyState(icon, message) {
  return `<div class="empty"><div class="big">${icon}</div><p>${escapeHtml(message)}</p></div>`;
}

/* ---------- 6. Coloured circle with the first letter ---------- */
const AVATAR_COLORS = ["#4f46e5", "#0ea5e9", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];
export function avatar(text) {
  const letter = (text || "?").trim().charAt(0).toUpperCase();
  let sum = 0;
  for (const ch of String(text || "")) sum += ch.charCodeAt(0);
  const color = AVATAR_COLORS[sum % AVATAR_COLORS.length];
  return `<span class="avatar" style="background:${color}" aria-hidden="true">${escapeHtml(letter)}</span>`;
}

/* ============================================================
   7. REUSABLE TABLE: sorting + pagination
   ------------------------------------------------------------
   renderTable({
     container: HTMLElement,
     columns: [{ key, label, sortable, render(row) }],
     rows: [...],
     pageSize, emptyIcon, emptyText
   })
   ============================================================ */
export function renderTable(options) {
  const {
    container,
    columns,
    rows,
    pageSize = 10,
    emptyIcon = "📭",
    emptyText = "Nothing to show yet.",
  } = options;

  // Sorting/paging state is remembered on the container element itself.
  const state = (container._tableState = container._tableState || { sortKey: null, dir: "asc", page: 1 });

  function sortedRows() {
    if (!state.sortKey) return rows.slice();
    const key = state.sortKey;
    return rows.slice().sort((a, b) => {
      let x = a[key], y = b[key];
      if (x === null || x === undefined) x = "";
      if (y === null || y === undefined) y = "";
      if (typeof x === "number" && typeof y === "number") return state.dir === "asc" ? x - y : y - x;
      const cmp = String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" });
      return state.dir === "asc" ? cmp : -cmp;
    });
  }

  function draw() {
    if (!rows.length) {
      container.innerHTML = emptyState(emptyIcon, emptyText);
      return;
    }

    const all = sortedRows();
    const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * pageSize;
    const pageRows = all.slice(start, start + pageSize);

    const head = columns
      .map((c) => {
        if (c.sortable === false) return `<th>${escapeHtml(c.label)}</th>`;
        const arrow = state.sortKey === c.key ? (state.dir === "asc" ? "▲" : "▼") : "↕";
        return `<th class="sortable" data-key="${escapeHtml(c.key)}" title="Click to sort">
                  ${escapeHtml(c.label)} <span class="arrow">${arrow}</span>
                </th>`;
      })
      .join("");

    const body = pageRows
      .map(
        (row) =>
          `<tr>${columns
            .map((c) => `<td>${c.render ? c.render(row) : escapeHtml(row[c.key])}</td>`)
            .join("")}</tr>`
      )
      .join("");

    container.innerHTML = `
      <div class="table-wrap">
        <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      </div>
      <div class="pagination">
        <span class="info">Showing ${start + 1}-${Math.min(start + pageSize, all.length)} of ${all.length}</span>
        <button class="btn btn-light btn-sm" data-page="prev" ${state.page === 1 ? "disabled" : ""}>Previous</button>
        <span class="badge badge-grey">Page ${state.page} of ${totalPages}</span>
        <button class="btn btn-light btn-sm" data-page="next" ${state.page === totalPages ? "disabled" : ""}>Next</button>
      </div>`;

    // Click a header to sort
    container.querySelectorAll("th.sortable").forEach((th) =>
      th.addEventListener("click", () => {
        const key = th.dataset.key;
        if (state.sortKey === key) state.dir = state.dir === "asc" ? "desc" : "asc";
        else { state.sortKey = key; state.dir = "asc"; }
        draw();
      })
    );

    // Pagination buttons
    container.querySelectorAll("[data-page]").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.page += btn.dataset.page === "next" ? 1 : -1;
        draw();
      })
    );
  }

  state.page = 1; // new data always starts on page 1
  draw();
}

/* ============================================================
   8. LAYOUT: sidebar + mobile hamburger, built once here
   ============================================================ */
const PAGES = [
  { href: "index.html", label: "Dashboard", icon: "M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "books.html", label: "Books", icon: "M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM8 3v18" },
  { href: "students.html", label: "Students", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
  { href: "borrowing.html", label: "Borrowing", icon: "M4 7h16M4 12h16M4 17h10" },
  { href: "documentation.html", label: "Documentation", icon: "M6 3h9l4 4v14H6zM14 3v5h5" },
];

export function initLayout(activeFile) {
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="brand">
        <span class="brand-logo" aria-hidden="true">📚</span>
        <span>SchoolLib<small>Library Management</small></span>
      </div>
      <nav class="nav" aria-label="Main navigation">
        ${PAGES.map(
          (p) => `<a href="${p.href}" class="${p.href === activeFile ? "active" : ""}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="${p.icon}"/>
            </svg>${p.label}</a>`
        ).join("")}
      </nav>
      <div class="sidebar-foot">School Project &copy; ${new Date().getFullYear()}</div>`;
  }

  // Mobile menu
  const burger = document.querySelector(".hamburger");
  const backdrop = document.querySelector(".backdrop");
  if (burger && sidebar && backdrop) {
    const close = () => { sidebar.classList.remove("open"); backdrop.classList.remove("show"); };
    burger.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      backdrop.classList.toggle("show");
    });
    backdrop.addEventListener("click", close);
  }

  // Warn if config.js still has placeholder keys
  if (!IS_CONFIGURED) {
    const content = document.querySelector(".content");
    if (content) {
      const div = document.createElement("div");
      div.className = "notice no-print";
      div.innerHTML = `<strong>Database not connected yet.</strong> Open <code>js/config.js</code> and
        paste your Supabase project URL and anon key, then run <code>sql/schema.sql</code>
        in the Supabase SQL editor. See the <a href="documentation.html#setup">setup guide</a>.`;
      content.prepend(div);
    }
  }
}
