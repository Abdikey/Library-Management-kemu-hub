/* ============================================================
   BOOKS PAGE - add, edit, delete, search and filter books
   ============================================================ */

import { db, PAGE_SIZE } from "./config.js";
import {
  initLayout, renderTable, showSpinner, escapeHtml, toast, friendlyError,
  avatar, openModal, closeModal, wireModal, emptyState,
} from "./app.js";

initLayout("books.html");
wireModal("book-modal");

const tableBox = document.getElementById("table");
const searchInput = document.getElementById("search");
const categoryFilter = document.getElementById("category-filter");
const countBadge = document.getElementById("count");
const form = document.getElementById("book-form");

let allBooks = []; // everything we loaded from the database
let editingId = null; // null = adding a new book

document.getElementById("add-btn").addEventListener("click", () => openForm());
document.getElementById("print-btn").addEventListener("click", () => window.print());
searchInput.addEventListener("input", draw);
tableBox.addEventListener("click", onTableClick); // wired once
categoryFilter.addEventListener("change", draw);
form.addEventListener("submit", saveBook);

loadBooks();

/* ---------- Load ---------- */
async function loadBooks() {
  showSpinner(tableBox);
  try {
    const { data, error } = await db.from("books").select("*").order("title");
    if (error) throw error;
    allBooks = data || [];
    fillCategoryFilter();
    draw();
  } catch (error) {
    toast(friendlyError(error), "error");
    tableBox.innerHTML = emptyState("⚠️", friendlyError(error));
  }
}

function fillCategoryFilter() {
  const categories = [...new Set(allBooks.map((b) => b.category))].sort();
  categoryFilter.innerHTML =
    `<option value="">All categories</option>` +
    categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

/* ---------- Draw table ---------- */
function draw() {
  const term = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;

  const rows = allBooks.filter((b) => {
    const matchesTerm =
      !term ||
      b.title.toLowerCase().includes(term) ||
      b.author.toLowerCase().includes(term) ||
      (b.isbn || "").toLowerCase().includes(term);
    const matchesCategory = !category || b.category === category;
    return matchesTerm && matchesCategory;
  });

  countBadge.textContent = `${rows.length} book${rows.length === 1 ? "" : "s"}`;

  renderTable({
    container: tableBox,
    rows,
    pageSize: PAGE_SIZE,
    emptyIcon: "📚",
    emptyText: "No books found.",
    columns: [
      {
        key: "title",
        label: "Title",
        render: (b) => `<span class="cell-title">${avatar(b.title)}
          <span><strong>${escapeHtml(b.title)}</strong>
          <span class="cell-sub">ISBN ${escapeHtml(b.isbn)}</span></span></span>`,
      },
      { key: "author", label: "Author" },
      { key: "category", label: "Category", render: (b) => `<span class="badge badge-indigo">${escapeHtml(b.category)}</span>` },
      { key: "publisher", label: "Publisher", render: (b) => escapeHtml(b.publisher || "—") },
      { key: "year", label: "Year", render: (b) => escapeHtml(b.year ?? "—") },
      {
        key: "available_copies",
        label: "Copies",
        render: (b) => `${b.available_copies} of ${b.total_copies}`,
      },
      {
        key: "available_copies",
        label: "Availability",
        sortable: false,
        render: (b) =>
          b.available_copies > 0
            ? `<span class="badge badge-green">Available</span>`
            : `<span class="badge badge-red">Out of stock</span>`,
      },
      {
        key: "actions",
        label: "Actions",
        sortable: false,
        render: (b) => `<span class="no-print">
            <button class="btn btn-light btn-sm" data-edit="${b.id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-delete="${b.id}">Delete</button>
          </span>`,
      },
    ],
  });
}

function onTableClick(event) {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  if (editId) openForm(allBooks.find((b) => b.id === editId));
  if (deleteId) deleteBook(allBooks.find((b) => b.id === deleteId));
}

/* ---------- Add / edit ---------- */
function openForm(book) {
  editingId = book ? book.id : null;
  document.getElementById("book-modal-title").textContent = book ? "Edit book" : "Add book";
  form.title.value = book?.title || "";
  form.author.value = book?.author || "";
  form.isbn.value = book?.isbn || "";
  form.category.value = book?.category || "Fiction";
  form.publisher.value = book?.publisher || "";
  form.year.value = book?.year || "";
  form.total_copies.value = book?.total_copies ?? 1;
  openModal("book-modal");
  form.title.focus();
}

async function saveBook(event) {
  event.preventDefault();
  const saveBtn = document.getElementById("save-btn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  const total = Number(form.total_copies.value);
  const values = {
    title: form.title.value.trim(),
    author: form.author.value.trim(),
    isbn: form.isbn.value.trim(),
    category: form.category.value,
    publisher: form.publisher.value.trim() || null,
    year: form.year.value ? Number(form.year.value) : null,
    total_copies: total,
  };

  try {
    if (editingId) {
      // Keep available copies in step with a change in total copies,
      // without ever going below zero or above the new total.
      const book = allBooks.find((b) => b.id === editingId);
      const onLoan = book.total_copies - book.available_copies;
      if (total < onLoan) {
        throw new Error(`${onLoan} copies are currently on loan, so total copies cannot be less than ${onLoan}.`);
      }
      values.available_copies = total - onLoan;
      const { error } = await db.from("books").update(values).eq("id", editingId);
      if (error) throw error;
      toast("Book updated.", "success");
    } else {
      values.available_copies = total; // a new book starts fully on the shelf
      const { error } = await db.from("books").insert(values);
      if (error) throw error;
      toast("Book added.", "success");
    }
    closeModal("book-modal");
    await loadBooks();
  } catch (error) {
    toast(friendlyError(error), "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save book";
  }
}

/* ---------- Delete ---------- */
async function deleteBook(book) {
  if (!book) return;
  try {
    // A book with borrowing history must stay, so the records make sense.
    const { count, error: countError } = await db
      .from("borrowings").select("id", { count: "exact", head: true }).eq("book_id", book.id);
    if (countError) throw countError;

    if (count > 0) {
      toast(`"${book.title}" has ${count} borrowing record(s), so it cannot be deleted. The history must stay.`, "warning");
      return;
    }
    if (!confirm(`Delete "${book.title}"? This cannot be undone.`)) return;

    const { error } = await db.from("books").delete().eq("id", book.id);
    if (error) throw error;
    toast("Book deleted.", "success");
    await loadBooks();
  } catch (error) {
    toast(friendlyError(error), "error");
  }
}
