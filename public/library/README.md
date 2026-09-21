# SchoolLib — Library Management System

A school project: a library management system built with **plain HTML, CSS and vanilla
JavaScript (ES6 modules)** and a **Supabase (PostgreSQL)** database. No frameworks, no
build tools, nothing to compile.

## Features

- **Dashboard** — total books, total students, books on loan, overdue count, a
  category bar chart, overdue list and recently issued books.
- **Books** — add, edit, delete, search by title/author/ISBN, filter by category,
  unique ISBN, copy tracking.
- **Students** — add, edit, delete, search, filter by class, per-student borrowing history.
- **Borrowing** — issue a book, accept returns, automatic fine calculation, status
  badges for borrowed / overdue / returned.
- Sortable, paginated tables; toast messages; friendly error messages; print-friendly
  pages; responsive layout with a mobile menu.

## Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste all of `sql/schema.sql`, and click **Run**.
   This creates the tables, triggers, the `borrowings_view` view and sample data
   (20 books, 15 students, 10 borrowings).
3. Open **Project Settings → API** and copy the *Project URL* and the *anon public* key.
4. Paste them into `js/config.js`:

   ```js
   export const SUPABASE_URL = "https://your-project.supabase.co";
   export const SUPABASE_ANON_KEY = "your-anon-public-key";
   ```

5. Open `index.html` in a browser, or serve the folder:

   ```bash
   python -m http.server 8000     # then visit http://localhost:8000
   ```

Until the keys are filled in, every page shows a warning banner and no data loads.

## Library rules (all in `js/config.js`)

| Rule | Default |
| --- | --- |
| Loan period | 14 days |
| Fine | KES 10 per late day |
| Borrowing limit | 3 books per student |

A student also cannot hold two copies of the same title, and a book with no free copy
cannot be issued.

## File structure

```
library/
├── index.html           Dashboard
├── books.html           Book catalogue
├── students.html        Student register
├── borrowing.html       Issue and return books
├── documentation.html   Full project documentation
├── css/style.css        All styling
├── js/config.js         Supabase keys + library rules
├── js/app.js            Shared helpers (tables, modals, toasts, dates)
├── js/dashboard.js
├── js/books.js
├── js/students.js
├── js/borrowing.js
├── js/documentation.js
└── sql/schema.sql       Tables, triggers, view, sample data
```

## How it works

- `js/app.js` holds every shared piece: the sidebar, the sortable/paginated table,
  modals, toasts, date maths and HTML escaping. Pages never duplicate code.
- Database triggers keep `available_copies` correct: issuing a book removes a copy,
  saving a return date puts it back and sets the status to `returned`.
- `borrowings_view` joins books, students and borrowings and calculates `is_overdue`
  on read, so overdue status is never stale.
- All user text is escaped before it is inserted into the page.

## Security note

There is no login, so the Row Level Security policies allow anyone with the anon key to
read and write — fine for a classroom demo. A real system would add authentication and
restrict write access to librarian accounts.
