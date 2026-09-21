/* ============================================================
   STUDENTS PAGE - add, edit, delete, search and view history
   ============================================================ */

import { db, PAGE_SIZE } from "./config.js";
import {
  initLayout, renderTable, showSpinner, escapeHtml, toast, friendlyError,
  avatar, openModal, closeModal, wireModal, emptyState, formatDate, money,
} from "./app.js";

initLayout("students.html");
wireModal("student-modal");
wireModal("history-modal");

const tableBox = document.getElementById("table");
const searchInput = document.getElementById("search");
const classFilter = document.getElementById("class-filter");
const countBadge = document.getElementById("count");
const form = document.getElementById("student-form");

let allStudents = [];
let loanCounts = {}; // student_id -> number of books currently held
let editingId = null;

document.getElementById("add-btn").addEventListener("click", () => openForm());
document.getElementById("print-btn").addEventListener("click", () => window.print());
searchInput.addEventListener("input", draw);
classFilter.addEventListener("change", draw);
form.addEventListener("submit", saveStudent);
tableBox.addEventListener("click", onTableClick); // wired once

loadStudents();

/* ---------- Load ---------- */
async function loadStudents() {
  showSpinner(tableBox);
  try {
    const [studentsRes, loansRes] = await Promise.all([
      db.from("students").select("*").order("admission_no"),
      db.from("borrowings").select("student_id").eq("status", "borrowed"),
    ]);
    if (studentsRes.error) throw studentsRes.error;
    if (loansRes.error) throw loansRes.error;

    allStudents = studentsRes.data || [];
    loanCounts = {};
    (loansRes.data || []).forEach((l) => {
      loanCounts[l.student_id] = (loanCounts[l.student_id] || 0) + 1;
    });

    fillClassFilter();
    draw();
  } catch (error) {
    toast(friendlyError(error), "error");
    tableBox.innerHTML = emptyState("⚠️", friendlyError(error));
  }
}

function fillClassFilter() {
  const classes = [...new Set(allStudents.map((s) => s.class))].sort();
  classFilter.innerHTML =
    `<option value="">All classes</option>` +
    classes.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

/* ---------- Draw table ---------- */
function draw() {
  const term = searchInput.value.trim().toLowerCase();
  const klass = classFilter.value;

  const rows = allStudents
    .filter((s) => {
      const matchesTerm =
        !term ||
        s.full_name.toLowerCase().includes(term) ||
        s.admission_no.toLowerCase().includes(term) ||
        s.class.toLowerCase().includes(term);
      return matchesTerm && (!klass || s.class === klass);
    })
    .map((s) => ({ ...s, books_out: loanCounts[s.id] || 0 }));

  countBadge.textContent = `${rows.length} student${rows.length === 1 ? "" : "s"}`;

  renderTable({
    container: tableBox,
    rows,
    pageSize: PAGE_SIZE,
    emptyIcon: "🎓",
    emptyText: "No students found.",
    columns: [
      {
        key: "full_name",
        label: "Student",
        render: (s) => `<span class="cell-title">${avatar(s.full_name)}
          <span><strong>${escapeHtml(s.full_name)}</strong>
          <span class="cell-sub">${escapeHtml(s.admission_no)}</span></span></span>`,
      },
      { key: "class", label: "Class", render: (s) => `<span class="badge badge-indigo">${escapeHtml(s.class)}</span>` },
      { key: "email", label: "Email", render: (s) => escapeHtml(s.email || "—") },
      { key: "phone", label: "Phone", render: (s) => escapeHtml(s.phone || "—") },
      {
        key: "books_out",
        label: "Books held",
        render: (s) =>
          s.books_out > 0
            ? `<span class="badge badge-amber">${s.books_out}</span>`
            : `<span class="badge badge-grey">0</span>`,
      },
      {
        key: "actions",
        label: "Actions",
        sortable: false,
        render: (s) => `<span class="no-print">
            <button class="btn btn-light btn-sm" data-history="${s.id}">History</button>
            <button class="btn btn-light btn-sm" data-edit="${s.id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-delete="${s.id}">Delete</button>
          </span>`,
      },
    ],
  });
}

function onTableClick(event) {
  const { edit, delete: del, history } = event.target.dataset;
  if (edit) openForm(allStudents.find((s) => s.id === edit));
  if (del) deleteStudent(allStudents.find((s) => s.id === del));
  if (history) showHistory(allStudents.find((s) => s.id === history));
}

/* ---------- Add / edit ---------- */
function openForm(student) {
  editingId = student ? student.id : null;
  document.getElementById("student-modal-title").textContent = student ? "Edit student" : "Add student";
  form.full_name.value = student?.full_name || "";
  form.admission_no.value = student?.admission_no || "";
  form.class.value = student?.class || "Form 1";
  form.email.value = student?.email || "";
  form.phone.value = student?.phone || "";
  openModal("student-modal");
  form.full_name.focus();
}

async function saveStudent(event) {
  event.preventDefault();
  const saveBtn = document.getElementById("save-btn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  const values = {
    full_name: form.full_name.value.trim(),
    admission_no: form.admission_no.value.trim(),
    class: form.class.value,
    email: form.email.value.trim() || null,
    phone: form.phone.value.trim() || null,
  };

  try {
    const { error } = editingId
      ? await db.from("students").update(values).eq("id", editingId)
      : await db.from("students").insert(values);
    if (error) throw error;
    toast(editingId ? "Student updated." : "Student added.", "success");
    closeModal("student-modal");
    await loadStudents();
  } catch (error) {
    toast(friendlyError(error), "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save student";
  }
}

/* ---------- Delete ---------- */
async function deleteStudent(student) {
  if (!student) return;
  try {
    const { count, error: countError } = await db
      .from("borrowings").select("id", { count: "exact", head: true }).eq("student_id", student.id);
    if (countError) throw countError;

    if (count > 0) {
      toast(`${student.full_name} has ${count} borrowing record(s), so the record cannot be deleted.`, "warning");
      return;
    }
    if (!confirm(`Delete ${student.full_name}? This cannot be undone.`)) return;

    const { error } = await db.from("students").delete().eq("id", student.id);
    if (error) throw error;
    toast("Student deleted.", "success");
    await loadStudents();
  } catch (error) {
    toast(friendlyError(error), "error");
  }
}

/* ---------- History ---------- */
async function showHistory(student) {
  if (!student) return;
  const body = document.getElementById("history-body");
  document.getElementById("history-modal-title").textContent = `History — ${student.full_name}`;
  openModal("history-modal");
  showSpinner(body);

  try {
    const { data, error } = await db
      .from("borrowings_view").select("*")
      .eq("student_id", student.id)
      .order("issue_date", { ascending: false });
    if (error) throw error;

    const rows = data || [];
    if (!rows.length) {
      body.innerHTML = emptyState("📄", "This student has never borrowed a book.");
      return;
    }
    body.innerHTML = `<ul class="list">${rows
      .map(
        (r) => `<li>
          ${avatar(r.book_title)}
          <span class="grow">
            <strong>${escapeHtml(r.book_title)}</strong>
            <span class="cell-sub">Issued ${formatDate(r.issue_date)} &middot; due ${formatDate(r.due_date)}
            ${r.return_date ? `&middot; returned ${formatDate(r.return_date)}` : ""}</span>
          </span>
          ${
            r.status === "returned"
              ? `<span class="badge badge-green">Returned${Number(r.fine_amount) > 0 ? ` · fine ${money(r.fine_amount)}` : ""}</span>`
              : r.is_overdue
                ? `<span class="badge badge-red">Overdue</span>`
                : `<span class="badge badge-indigo">Borrowed</span>`
          }
        </li>`
      )
      .join("")}</ul>`;
  } catch (error) {
    body.innerHTML = emptyState("⚠️", friendlyError(error));
  }
}
