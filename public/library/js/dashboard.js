/* ============================================================
   DASHBOARD PAGE
   Shows totals, a category chart, overdue books and recent loans.
   ============================================================ */

import { db, PAGE_SIZE } from "./config.js";
import {
  initLayout, renderTable, showSpinner, emptyState, escapeHtml,
  formatDate, toast, friendlyError, avatar, daysBetween, today,
} from "./app.js";

initLayout("index.html");

const chartBox = document.getElementById("chart");
const overdueBox = document.getElementById("overdue-list");
const recentBox = document.getElementById("recent");

loadDashboard();

async function loadDashboard() {
  showSpinner(chartBox);
  showSpinner(overdueBox);
  showSpinner(recentBox);

  try {
    // Ask the database for everything we need (in parallel).
    const [booksRes, studentsRes, loansRes] = await Promise.all([
      db.from("books").select("category, total_copies"),
      db.from("students").select("id"),
      db.from("borrowings_view").select("*").order("issue_date", { ascending: false }),
    ]);

    if (booksRes.error) throw booksRes.error;
    if (studentsRes.error) throw studentsRes.error;
    if (loansRes.error) throw loansRes.error;

    const books = booksRes.data || [];
    const loans = loansRes.data || [];
    const borrowed = loans.filter((l) => l.status === "borrowed");
    const overdue = borrowed.filter((l) => l.is_overdue);

    // ---- Stat cards ----
    const totalCopies = books.reduce((sum, b) => sum + (b.total_copies || 0), 0);
    document.getElementById("stat-books").textContent = totalCopies;
    document.getElementById("stat-students").textContent = (studentsRes.data || []).length;
    document.getElementById("stat-borrowed").textContent = borrowed.length;
    document.getElementById("stat-overdue").textContent = overdue.length;

    drawChart(books);
    drawOverdue(overdue);
    drawRecent(loans);
  } catch (error) {
    const msg = friendlyError(error);
    toast(msg, "error");
    chartBox.innerHTML = emptyState("⚠️", msg);
    overdueBox.innerHTML = emptyState("⚠️", "Could not load overdue books.");
    recentBox.innerHTML = emptyState("⚠️", "Could not load recent loans.");
  }
}

/** A simple bar chart made from divs - no chart library needed. */
function drawChart(books) {
  if (!books.length) {
    chartBox.innerHTML = emptyState("📊", "No books added yet.");
    return;
  }
  const counts = {};
  books.forEach((b) => {
    const key = b.category || "Uncategorised";
    counts[key] = (counts[key] || 0) + 1;
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries[0][1];

  chartBox.innerHTML = `<div class="chart">${entries
    .map(
      ([name, count]) => `
      <div class="bar-row">
        <span>${escapeHtml(name)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(count / max) * 100}%"></span></span>
        <strong>${count}</strong>
      </div>`
    )
    .join("")}</div>`;
}

function drawOverdue(rows) {
  if (!rows.length) {
    overdueBox.innerHTML = emptyState("✅", "No overdue books. Well done!");
    return;
  }
  overdueBox.innerHTML = `<ul class="list">${rows
    .slice(0, 6)
    .map((r) => {
      const late = daysBetween(r.due_date, today());
      return `<li>
        ${avatar(r.book_title)}
        <span class="grow">
          <strong>${escapeHtml(r.book_title)}</strong>
          <span class="cell-sub">${escapeHtml(r.student_name)} &middot; due ${formatDate(r.due_date)}</span>
        </span>
        <span class="badge badge-red">${late} day${late === 1 ? "" : "s"} late</span>
      </li>`;
    })
    .join("")}</ul>`;
}

function drawRecent(loans) {
  renderTable({
    container: recentBox,
    rows: loans.slice(0, 20),
    pageSize: PAGE_SIZE,
    emptyIcon: "📄",
    emptyText: "No books have been issued yet.",
    columns: [
      {
        key: "book_title",
        label: "Book",
        render: (r) => `<span class="cell-title">${avatar(r.book_title)}
          <span><strong>${escapeHtml(r.book_title)}</strong>
          <span class="cell-sub">${escapeHtml(r.book_author)}</span></span></span>`,
      },
      {
        key: "student_name",
        label: "Student",
        render: (r) => `${escapeHtml(r.student_name)}
          <div class="cell-sub">${escapeHtml(r.student_admission_no)} &middot; ${escapeHtml(r.student_class)}</div>`,
      },
      { key: "issue_date", label: "Issued", render: (r) => formatDate(r.issue_date) },
      { key: "due_date", label: "Due", render: (r) => formatDate(r.due_date) },
      {
        key: "status",
        label: "Status",
        render: (r) =>
          r.status === "returned"
            ? `<span class="badge badge-green">Returned</span>`
            : r.is_overdue
              ? `<span class="badge badge-red">Overdue</span>`
              : `<span class="badge badge-indigo">Borrowed</span>`,
      },
    ],
  });
}
