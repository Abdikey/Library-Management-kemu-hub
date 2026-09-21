# Library Companion

Build a simple, professional Library Management System for a school project.

## TECH STACK (STRICT)
- Use ONLY plain HTML, CSS and vanilla JavaScript (ES6 modules are fine).
- NO React, Vue, Angular, TypeScript, Tailwind, Bootstrap or any build tools.
- Use the Supabase JavaScript client via CDN:
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
- Put the Supabase URL and anon key in one file, js/config.js, so they are easy to change.
- Use Supabase (free tier) as the database. No custom backend.
- Use Google Fonts (Inter) and simple inline SVG icons or Font Awesome via CDN.

## FILE STRUCTURE
index.html          (dashboard)
books.html
students.html
borrowing.html      (issue and return books)
documentation.html
README.md
css/style.css       (one shared stylesheet, including a @media print section)
js/config.js        (Supabase client setup + constants)
js/app.js           (shared helpers: navbar, toast, modal, date formatting, table sorting, pagination, HTML escaping)
js/dashboard.js
js/books.js
js/students.js
js/borrowing.js
sql/schema.sql      (tables, constraints, triggers, view, sample data)

## CONSTANTS (define in js/config.js)
- LOAN_DAYS = 14
- FINE_PER_DAY = 10
- MAX_BOOKS_PER_STUDENT = 3
- CURRENCY = "KES"
- PAGE_SIZE = 10

## DATABASE (Supabase / PostgreSQL) - sql/schema.sql
Tables:
1. books: id (uuid, pk, default gen_random_uuid()), title, author, isbn (unique), category, publisher, year (int), total_copies (int), available_copies (int), created_at.
   - CHECK (available_copies >= 0 AND available_copies <= total_copies)
2. students: id (uuid, pk), admission_no (unique), full_name, class, email, phone, created_at.
3. borrowings: id (uuid, pk), book_id (fk -> books, on delete restrict), student_id (fk -> students, on delete restrict), issue_date (date), due_date (date), return_date (date, nullable), status ('borrowed' | 'returned' ONLY), fine_amount (numeric, default 0), created_at.

Integrity (do this in the database, not in JavaScript):
- Create a trigger that DECREASES books.available_copies when a borrowing row is inserted.
- Create a trigger that INCREASES books.available_copies when return_date is set on a borrowing (and sets status = 'returned').
- The JavaScript must NOT update available_copies manually.
- Create a view called borrowings_view that joins borrowings, books and students and adds a calculated column is_overdue (return_date IS NULL AND due_date < CURRENT_DATE).
- Never store "overdue" as a status. Calculate it.

Security (demo only):
- Enable Row Level Security on all tables with simple policies allowing anon read/insert/update/delete. Add a comment explaining this is for a school demo and that a real system would require login.

Sample data:
- 20 books across Fiction, Science, Mathematics, History, Technology, Literature and Biography, with realistic titles, authors and unique ISBNs.
- 15 students with realistic names (mix of Kenyan names), admission numbers, classes (Form 1 to Form 4), emails and phones.
- 10 borrowing records: a mix of currently borrowed, returned on time, returned late (with fines) and overdue. Make sure the triggers/data leave available_copies consistent.

Add clear instructions at the top of the file on how to run it in the Supabase SQL Editor.

## FEATURES (keep it simple but complete)
1. Dashboard: stat cards (total books, total students, currently borrowed, overdue), "Recently issued" table, "Overdue books" list, and a simple category chart built with pure CSS/JS (no chart library).
2. Books: table with add, edit and delete via a modal, search (title, author, ISBN), category filter, availability badge (Available / Out of stock), and coloured circles showing the first letter of the title instead of book covers.
3. Students: table with add, edit and delete via a modal, search by name or admission number, and a "View history" button showing that student's borrowing records.
4. Borrowing:
   - Issue a book: choose student and book (only books with available_copies > 0). Issue date defaults to today, due date defaults to today + LOAN_DAYS.
   - Rules: block if the student already has MAX_BOOKS_PER_STUDENT unreturned books, or already has an unreturned copy of the same book. Show a clear error toast.
   - Return a book: one-click button that sets return_date to today and calculates fine_amount = days late x FINE_PER_DAY (0 if on time). Show the fine in the toast with CURRENCY.
   - Filter tabs: All / Borrowed / Overdue / Returned. Overdue rows show a red badge (calculated, not stored).
   - A "Print" button that calls window.print(). Add a @media print stylesheet hiding the sidebar, buttons and filters.
5. Tables: sortable columns (click a header to sort ascending/descending) and pagination of PAGE_SIZE rows per page, implemented as reusable helpers in js/app.js.
6. Validation and feedback: required fields, unique ISBN and admission number errors handled gracefully, confirm before delete, prevent deleting a book or student with borrowing records (explain why), toast notifications, loading spinners, and empty states ("No books found").

Do NOT add: user authentication, roles, payments, email/SMS, barcode scanning, or export features. Keep it beginner-friendly.

## DESIGN
- Modern, clean, professional look: fixed left sidebar (collapses to a hamburger menu on mobile), white cards with soft shadows and 12px rounded corners, generous spacing.
- Colour palette as CSS variables in :root: primary indigo (#4f46e5), light background (#f8fafc), dark slate text (#0f172a), green for success, amber for warning, red for danger.
- Pill-shaped status badges, hover effects on rows and buttons, smooth transitions, modals with dimmed backdrop.
- Fully responsive (desktop, tablet, mobile); tables scroll horizontally on small screens.
- Consistent layout on every page: same sidebar, header with page title, and footer.
- Add a favicon (emoji or inline SVG), a descriptive <title> on each page, and accessible labels on all form inputs.

## DOCUMENTATION PAGE (documentation.html)
A clean, readable page with a sticky table of contents, written for a school audience:
1. Project Overview: what it is and the problem it solves.
2. Objectives.
3. Features list.
4. Technologies Used (HTML, CSS, JavaScript, Supabase) and why each was chosen.
5. System Architecture: a simple diagram using HTML/CSS boxes and arrows (Browser -> JavaScript -> Supabase Database).
6. Database Design: each table with its fields, plus a simple ERD-style diagram of relationships. Explain the triggers and the overdue view in plain language.
7. How It Works: step-by-step flow for issuing and returning a book, including the borrowing rules and fine calculation.
8. Setup Guide: create a free Supabase project, run schema.sql, paste the URL and anon key into config.js, and open index.html.
9. User Guide: adding books and students, issuing and returning books, searching, sorting and printing.
10. Testing: a checklist table of test cases (add a book, issue a book, return on time, return late and check the fine, try exceeding the borrowing limit, try issuing a book with 0 copies, delete a student with history) with Expected Result and a Pass/Fail column.
11. Screenshots: placeholder boxes for the dashboard, books, students and borrowing pages.
12. Limitations and Future Improvements (login system, email reminders, barcode scanner, reports).
13. Conclusion.

Also generate README.md in the project root with a short description, setup steps and folder structure.

## CODE QUALITY
- Clear, beginner-friendly comments throughout.
- async/await for all Supabase calls, wrapped in try/catch, with user-friendly error messages.
- Small reusable functions; no duplicated code between pages.
- Escape all user-provided text before inserting it into the DOM.
- The app must run by opening index.html or through any simple static server.

## BUILD ORDER
1. Folder structure and sql/schema.sql (with triggers, view and sample data).
2. css/style.css, js/config.js and js/app.js (shared code).
3. Dashboard, then Books, Students and Borrowing pages.
4. Documentation page and README.md.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bcc1cd8c-1c16-4753-965b-8a3b6084953a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
