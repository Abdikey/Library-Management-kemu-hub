/* ============================================================
   BORROWING PAGE - issue books, accept returns, calculate fines
   ------------------------------------------------------------
   Rules (all kept in js/config.js):
     - a loan lasts LOAN_DAYS days
     - a student may hold at most MAX_BOOKS_PER_STUDENT books
     - a late return costs FINE_PER_DAY for each day past the due date
   ============================================================ */

import { db, PAGE_SIZE, LOAN_DAYS, FINE_PER_DAY, MAX_BOOKS_PER_STUDENT } from "./config.js";
import {
  initLayout, renderTable, showSpinner, escapeHtml, toast, friendlyError, avatar,
  openModal, closeModal, wireModal, emptyState, formatDate, money, today, addDays, daysBetween,
} from "./app.js";

initLayout("borrowing.html");
wireModal("issue-modal");
wireModal("return-modal");
wireModal("payment-modal");

const tableBox = document.getElementById("table");
const searchInput = document.getElementById("search");
const statusFilter = document.getElementById("status-filter");
const countBadge = document.getElementById("count");
const issueForm = document.getElementById("issue-form");
const returnForm = document.getElementById("return-form");
const paymentForm = document.getElementById("payment-form");

let allLoans = [];
let books = [];
let students = [];
let returning = null; // the loan being returned
let paying = null;
let paymentTimer = null;
let paidFineIds = new Set();

document.getElementById("issue-btn").addEventListener("click", openIssueForm);
document.getElementById("print-btn").addEventListener("click", () => window.print());
searchInput.addEventListener("input", draw);
statusFilter.addEventListener("change", draw);
issueForm.addEventListener("submit", issueBook);
returnForm.addEventListener("submit", returnBook);
paymentForm.addEventListener("submit", startFinePayment);
issueForm.issue_date.addEventListener("change", () => {
  issueForm.due_date.value = addDays(issueForm.issue_date.value || today(), LOAN_DAYS);
});
returnForm.return_date.addEventListener("change", updateFineBox);
tableBox.addEventListener("click", onTableClick); // wired once

document.getElementById("rules-hint").textContent =
  `A loan lasts ${LOAN_DAYS} days. A student may hold up to ${MAX_BOOKS_PER_STUDENT} books. ` +
  `Late returns are fined ${money(FINE_PER_DAY)} per day.`;

loadAll();

/* ---------- Load ---------- */
async function loadAll() {
  showSpinner(tableBox);
  try {
    const [loansRes, booksRes, studentsRes] = await Promise.all([
      db.from("borrowings_view").select("*").order("issue_date", { ascending: false }),
      db.from("books").select("*").order("title"),
      db.from("students").select("*").order("full_name"),
    ]);
    if (loansRes.error) throw loansRes.error;
    if (booksRes.error) throw booksRes.error;
    if (studentsRes.error) throw studentsRes.error;

    allLoans = loansRes.data || [];
    books = booksRes.data || [];
    students = studentsRes.data || [];

    try {
      const loanIds = allLoans.map((loan) => loan.id).join(",");
      const response = await fetch(`/api/public/fines/status?borrowing_ids=${encodeURIComponent(loanIds)}`);
      if (response.ok) {
        const data = await response.json();
        paidFineIds = new Set((data.paid || []).map((item) => item.borrowing_id));
      }
    } catch {
      paidFineIds = new Set();
    }

    drawStats();
    draw();
  } catch (error) {
    toast(friendlyError(error), "error");
    tableBox.innerHTML = emptyState("⚠️", friendlyError(error));
  }
}

function drawStats() {
  const borrowed = allLoans.filter((l) => l.status === "borrowed");
  const returned = allLoans.filter((l) => l.status === "returned");
  const fines = returned.reduce((sum, l) => sum + Number(l.fine_amount || 0), 0);
  document.getElementById("stat-borrowed").textContent = borrowed.length;
  document.getElementById("stat-overdue").textContent = borrowed.filter((l) => l.is_overdue).length;
  document.getElementById("stat-returned").textContent = returned.length;
  document.getElementById("stat-fines").textContent = money(fines);
}

/* ---------- Draw table ---------- */
function draw() {
  const term = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;

  const rows = allLoans.filter((l) => {
    const matchesTerm =
      !term ||
      l.book_title.toLowerCase().includes(term) ||
      l.student_name.toLowerCase().includes(term) ||
      l.student_admission_no.toLowerCase().includes(term);
    const matchesStatus =
      !status ||
      (status === "overdue" ? l.status === "borrowed" && l.is_overdue : l.status === status);
    return matchesTerm && matchesStatus;
  });

  countBadge.textContent = `${rows.length} record${rows.length === 1 ? "" : "s"}`;

  renderTable({
    container: tableBox,
    rows,
    pageSize: PAGE_SIZE,
    emptyIcon: "📤",
    emptyText: "No borrowing records found.",
    columns: [
      {
        key: "book_title",
        label: "Book",
        render: (l) => `<span class="cell-title">${avatar(l.book_title)}
          <span><strong>${escapeHtml(l.book_title)}</strong>
          <span class="cell-sub">${escapeHtml(l.book_author)}</span></span></span>`,
      },
      {
        key: "student_name",
        label: "Student",
        render: (l) => `${escapeHtml(l.student_name)}
          <div class="cell-sub">${escapeHtml(l.student_admission_no)} &middot; ${escapeHtml(l.student_class)}</div>`,
      },
      { key: "issue_date", label: "Issued", render: (l) => formatDate(l.issue_date) },
      {
        key: "due_date",
        label: "Due",
        render: (l) =>
          l.status === "borrowed" && l.is_overdue
            ? `<span class="text-red">${formatDate(l.due_date)}</span>
               <div class="cell-sub">${daysBetween(l.due_date, today())} day(s) late</div>`
            : formatDate(l.due_date),
      },
      { key: "return_date", label: "Returned", render: (l) => formatDate(l.return_date) },
      {
        key: "fine_amount",
        label: "Fine",
        render: (l) => {
          if (l.status === "returned") {
            return Number(l.fine_amount) > 0
              ? `<span class="badge badge-red">${money(l.fine_amount)}</span>`
              : `<span class="badge badge-grey">None</span>`;
          }
          const due = l.is_overdue ? daysBetween(l.due_date, today()) * FINE_PER_DAY : 0;
          return due > 0
            ? `<span class="badge badge-amber">${money(due)} so far</span>`
            : `<span class="badge badge-grey">None</span>`;
        },
      },
      {
        key: "status",
        label: "Status",
        render: (l) =>
          l.status === "returned"
            ? `<span class="badge badge-green">Returned</span>`
            : l.is_overdue
              ? `<span class="badge badge-red">Overdue</span>`
              : `<span class="badge badge-indigo">Borrowed</span>`,
      },
      {
        key: "actions",
        label: "Actions",
        sortable: false,
        render: (l) =>
          l.status === "returned"
            ? Number(l.fine_amount) > 0 && !paidFineIds.has(l.id)
              ? `<span class="no-print"><button class="btn btn-sm btn-success" data-pay="${l.id}">${money(l.fine_amount)} · Pay fine</button></span>`
              : `<span class="cell-sub">${paidFineIds.has(l.id) ? "Paid" : "—"}</span>`
            : `<span class="no-print"><button class="btn btn-sm" data-return="${l.id}">Return</button></span>`,
      },
    ],
  });
}

function onTableClick(event) {
  const target = event.target.closest("button");
  if (!target) return;
  const returnId = target.dataset.return;
  if (returnId) openReturnForm(allLoans.find((l) => l.id === returnId));
  const payId = target.dataset.pay;
  if (payId) openPaymentForm(allLoans.find((l) => l.id === payId));
}

/* ---------- M-Pesa fine payment ---------- */
function openPaymentForm(loan) {
  if (!loan || Number(loan.fine_amount) <= 0 || paidFineIds.has(loan.id)) return;
  paying = loan;
  paymentForm.reset();
  document.getElementById("payment-summary").innerHTML = `
    <p><strong>${escapeHtml(loan.student_name)}</strong> · ${escapeHtml(loan.book_title)}</p>
    <p class="payment-amount">${money(loan.fine_amount)}</p>`;
  document.getElementById("payment-progress").textContent = "";
  document.getElementById("payment-submit").disabled = false;
  openModal("payment-modal");
}

async function startFinePayment(event) {
  event.preventDefault();
  if (!paying) return;
  const submit = document.getElementById("payment-submit");
  const progress = document.getElementById("payment-progress");
  submit.disabled = true;
  submit.textContent = "Sending…";

  try {
    const response = await fetch("/api/public/fines/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ borrowingId: paying.id, phone: document.getElementById("payment-phone").value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not start the payment.");

    progress.textContent = `A test prompt was sent for ${money(result.amount)}. Approve it on the phone to finish.`;
    submit.textContent = "Waiting for payment…";
    if (paymentTimer) clearInterval(paymentTimer);
    let checks = 0;
    paymentTimer = setInterval(async () => {
      checks += 1;
      try {
        const statusResponse = await fetch(`/api/public/fines/status?id=${encodeURIComponent(result.paymentId)}`);
        const status = await statusResponse.json();
        if (status.status === "paid") {
          clearInterval(paymentTimer);
          paymentTimer = null;
          closeModal("payment-modal");
          toast(status.receipt ? `Fine paid. Receipt ${status.receipt}.` : "Fine paid successfully.", "success");
          paying = null;
          await loadAll();
        } else if (status.status === "failed") {
          clearInterval(paymentTimer);
          paymentTimer = null;
          progress.textContent = status.message || "Payment was not completed. You can try again.";
          submit.disabled = false;
          submit.textContent = "Try again";
        } else if (checks >= 30) {
          clearInterval(paymentTimer);
          paymentTimer = null;
          progress.textContent = "Still awaiting Safaricom. Check the phone, then close this window and refresh the borrowing list.";
          submit.disabled = false;
          submit.textContent = "Send another prompt";
        }
      } catch {
        if (checks >= 30) {
          clearInterval(paymentTimer);
          paymentTimer = null;
          progress.textContent = "Could not confirm the payment yet. Check the phone and refresh the borrowing list shortly.";
          submit.disabled = false;
          submit.textContent = "Try again";
        }
      }
    }, 3000);
  } catch (error) {
    progress.textContent = error instanceof Error ? error.message : "Could not start the payment.";
    submit.disabled = false;
    submit.textContent = "Try again";
  }
}

/* ---------- Issue a book ---------- */
function openIssueForm() {
  const available = books.filter((b) => b.available_copies > 0);

  if (!students.length) {
    toast("Add a student first, then you can issue a book.", "warning");
    return;
  }
  if (!available.length) {
    toast("No copies are available right now. Wait for a return.", "warning");
    return;
  }

  issueForm.student_id.innerHTML = students
    .map((s) => `<option value="${s.id}">${escapeHtml(s.full_name)} (${escapeHtml(s.admission_no)} · ${escapeHtml(s.class)})</option>`)
    .join("");
  issueForm.book_id.innerHTML = available
    .map((b) => `<option value="${b.id}">${escapeHtml(b.title)} — ${escapeHtml(b.author)} (${b.available_copies} free)</option>`)
    .join("");

  issueForm.issue_date.value = today();
  issueForm.due_date.value = addDays(today(), LOAN_DAYS);
  openModal("issue-modal");
}

async function issueBook(event) {
  event.preventDefault();
  const btn = document.getElementById("issue-save-btn");
  btn.disabled = true;
  btn.textContent = "Issuing…";

  const studentId = issueForm.student_id.value;
  const bookId = issueForm.book_id.value;
  const issueDate = issueForm.issue_date.value;
  const dueDate = issueForm.due_date.value;

  try {
    if (daysBetween(issueDate, dueDate) < 1) {
      throw new Error("The due date must be after the issue date.");
    }

    // Rule 1: the student must not already hold too many books.
    const held = allLoans.filter((l) => l.student_id === studentId && l.status === "borrowed");
    if (held.length >= MAX_BOOKS_PER_STUDENT) {
      throw new Error(`This student already holds ${held.length} books. The limit is ${MAX_BOOKS_PER_STUDENT}.`);
    }

    // Rule 2: the student must not borrow a second copy of the same title.
    if (held.some((l) => l.book_id === bookId)) {
      throw new Error("This student already has a copy of this book.");
    }

    // Rule 3: a copy must still be free (checked again against the database).
    const { data: book, error: bookError } = await db
      .from("books").select("available_copies").eq("id", bookId).single();
    if (bookError) throw bookError;
    if (!book || book.available_copies < 1) {
      throw new Error("The last copy has just been taken. Please choose another book.");
    }

    // The database trigger removes the copy from the shelf.
    const { error } = await db.from("borrowings").insert({
      book_id: bookId,
      student_id: studentId,
      issue_date: issueDate,
      due_date: dueDate,
    });
    if (error) throw error;

    toast("Book issued.", "success");
    closeModal("issue-modal");
    await loadAll();
  } catch (error) {
    toast(friendlyError(error), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Issue book";
  }
}

/* ---------- Return a book ---------- */
function openReturnForm(loan) {
  if (!loan) return;
  returning = loan;
  document.getElementById("return-summary").innerHTML = `
    <ul class="list"><li>${avatar(loan.book_title)}
      <span class="grow"><strong>${escapeHtml(loan.book_title)}</strong>
      <span class="cell-sub">${escapeHtml(loan.student_name)} &middot; due ${formatDate(loan.due_date)}</span></span>
    </li></ul>`;
  returnForm.return_date.value = today();
  updateFineBox();
  openModal("return-modal");
}

/** Fine = days late x FINE_PER_DAY. Never negative. */
function calculateFine(dueDate, returnDate) {
  const late = daysBetween(dueDate, returnDate);
  return late > 0 ? late * FINE_PER_DAY : 0;
}

function updateFineBox() {
  if (!returning) return;
  const box = document.getElementById("fine-box");
  const returnDate = returnForm.return_date.value || today();
  const late = daysBetween(returning.due_date, returnDate);
  const fine = calculateFine(returning.due_date, returnDate);

  box.innerHTML =
    fine > 0
      ? `<strong>${late} day${late === 1 ? "" : "s"} late.</strong> Fine to pay:
         ${money(FINE_PER_DAY)} × ${late} = <strong>${money(fine)}</strong>.`
      : `<strong>Returned on time.</strong> There is no fine.`;
}

async function returnBook(event) {
  event.preventDefault();
  const btn = document.getElementById("return-save-btn");
  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    const returnDate = returnForm.return_date.value;
    if (daysBetween(returning.issue_date, returnDate) < 0) {
      throw new Error("The return date cannot be before the issue date.");
    }
    const fine = calculateFine(returning.due_date, returnDate);

    // The trigger sets status = 'returned' and puts the copy back on the shelf.
    const { error } = await db
      .from("borrowings")
      .update({ return_date: returnDate, fine_amount: fine })
      .eq("id", returning.id);
    if (error) throw error;

    toast(fine > 0 ? `Book returned. Fine of ${money(fine)} recorded.` : "Book returned. No fine.", "success");
    closeModal("return-modal");
    returning = null;
    await loadAll();
  } catch (error) {
    toast(friendlyError(error), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm return";
  }
}
