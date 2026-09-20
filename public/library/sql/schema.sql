-- ============================================================
-- LIBRARY MANAGEMENT SYSTEM - DATABASE SCHEMA
-- ============================================================
-- HOW TO RUN THIS FILE
-- 1. Create a free account at https://supabase.com and create a new project.
-- 2. In your project, open the left menu and click "SQL Editor".
-- 3. Click "New query", then copy and paste EVERYTHING in this file.
-- 4. Click "Run". You should see "Success. No rows returned".
-- 5. Go to Project Settings -> API and copy the "Project URL" and the
--    "anon public" key into js/config.js.
-- 6. Open index.html in your browser.
--
-- Running this file again is safe: it drops the old tables first.
-- ============================================================

-- Clean start (order matters because of foreign keys)
drop view if exists borrowings_view;
drop table if exists borrowings;
drop table if exists books;
drop table if exists students;

-- ------------------------------------------------------------
-- 1. BOOKS
-- ------------------------------------------------------------
create table books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  isbn text not null unique,
  category text not null,
  publisher text,
  year int,
  total_copies int not null default 1,
  available_copies int not null default 1,
  created_at timestamptz not null default now(),
  -- A book can never have negative copies, or more free copies than it owns
  constraint copies_check check (available_copies >= 0 and available_copies <= total_copies)
);

-- ------------------------------------------------------------
-- 2. STUDENTS
-- ------------------------------------------------------------
create table students (
  id uuid primary key default gen_random_uuid(),
  admission_no text not null unique,
  full_name text not null,
  class text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. BORROWINGS (one row = one copy given to one student)
-- ------------------------------------------------------------
create table borrowings (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete restrict,
  student_id uuid not null references students(id) on delete restrict,
  issue_date date not null default current_date,
  due_date date not null,
  return_date date,
  -- Only two statuses are stored. "Overdue" is CALCULATED, never stored.
  status text not null default 'borrowed' check (status in ('borrowed', 'returned')),
  fine_amount numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index borrowings_book_idx on borrowings(book_id);
create index borrowings_student_idx on borrowings(student_id);

-- ------------------------------------------------------------
-- TRIGGERS: the database keeps available_copies correct.
-- The JavaScript never touches available_copies.
-- ------------------------------------------------------------

-- When a book is issued, one copy leaves the shelf.
create or replace function on_borrowing_insert()
returns trigger
language plpgsql
as $$
begin
  update books
     set available_copies = available_copies - 1
   where id = new.book_id;
  return new;
end;
$$;

create trigger trg_borrowing_insert
after insert on borrowings
for each row execute function on_borrowing_insert();

-- When a return_date is filled in, the copy comes back and status becomes 'returned'.
create or replace function on_borrowing_return()
returns trigger
language plpgsql
as $$
begin
  if old.return_date is null and new.return_date is not null then
    new.status := 'returned';
    update books
       set available_copies = available_copies + 1
     where id = new.book_id;
  end if;
  return new;
end;
$$;

create trigger trg_borrowing_return
before update on borrowings
for each row execute function on_borrowing_return();

-- ------------------------------------------------------------
-- VIEW: everything the app needs about a borrowing in one place.
-- is_overdue is calculated every time the view is read.
-- ------------------------------------------------------------
create view borrowings_view as
select
  b.id,
  b.book_id,
  b.student_id,
  b.issue_date,
  b.due_date,
  b.return_date,
  b.status,
  b.fine_amount,
  b.created_at,
  bk.title        as book_title,
  bk.author       as book_author,
  bk.isbn         as book_isbn,
  bk.category     as book_category,
  st.full_name    as student_name,
  st.admission_no as student_admission_no,
  st.class        as student_class,
  (b.return_date is null and b.due_date < current_date) as is_overdue
from borrowings b
join books bk on bk.id = b.book_id
join students st on st.id = b.student_id;

-- ------------------------------------------------------------
-- SECURITY (SCHOOL DEMO ONLY)
-- Row Level Security is on, but the policies allow anyone with the
-- anon key to read and write. That is fine for a classroom demo where
-- there is no login. A REAL library system would require users to sign
-- in and would only allow librarians to add, edit or delete records.
-- ------------------------------------------------------------
alter table books enable row level security;
alter table students enable row level security;
alter table borrowings enable row level security;

create policy "demo all access" on books       for all to anon, authenticated using (true) with check (true);
create policy "demo all access" on students    for all to anon, authenticated using (true) with check (true);
create policy "demo all access" on borrowings  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on books, students, borrowings to anon, authenticated;
grant select on borrowings_view to anon, authenticated;

-- ------------------------------------------------------------
-- SAMPLE DATA: 20 books
-- available_copies is set to total_copies here; the triggers will
-- reduce it automatically when the sample borrowings are inserted.
-- ------------------------------------------------------------
insert into books (title, author, isbn, category, publisher, year, total_copies, available_copies) values
('Things Fall Apart',            'Chinua Achebe',        '9780385474542', 'Fiction',     'Anchor Books',       1958, 4, 4),
('The River Between',            'Ngugi wa Thiong''o',   '9780435905484', 'Fiction',     'Heinemann',          1965, 3, 3),
('Petals of Blood',              'Ngugi wa Thiong''o',   '9780143039174', 'Fiction',     'Penguin Classics',   1977, 2, 2),
('Animal Farm',                  'George Orwell',        '9780451526342', 'Fiction',     'Signet Classics',    1945, 5, 5),
('A Brief History of Time',      'Stephen Hawking',      '9780553380163', 'Science',     'Bantam',             1988, 3, 3),
('The Selfish Gene',             'Richard Dawkins',      '9780199291151', 'Science',     'Oxford Press',       1976, 2, 2),
('Cosmos',                       'Carl Sagan',           '9780345539435', 'Science',     'Ballantine Books',   1980, 2, 2),
('Silent Spring',                'Rachel Carson',        '9780618249060', 'Science',     'Mariner Books',      1962, 2, 2),
('Calculus Made Easy',           'Silvanus P. Thompson', '9780312185480', 'Mathematics', 'St. Martin''s',      1910, 3, 3),
('Introduction to Algorithms',   'Thomas H. Cormen',     '9780262046305', 'Mathematics', 'MIT Press',          2022, 2, 2),
('The Joy of x',                 'Steven Strogatz',      '9780544105850', 'Mathematics', 'Mariner Books',      2012, 2, 2),
('Sapiens',                      'Yuval Noah Harari',    '9780062316097', 'History',     'Harper',             2011, 4, 4),
('Facing Mount Kenya',           'Jomo Kenyatta',        '9780679728146', 'History',     'Vintage',            1938, 3, 3),
('Guns, Germs and Steel',        'Jared Diamond',        '9780393354324', 'History',     'W. W. Norton',       1997, 2, 2),
('Clean Code',                   'Robert C. Martin',     '9780132350884', 'Technology',  'Prentice Hall',      2008, 3, 3),
('Eloquent JavaScript',          'Marijn Haverbeke',     '9781593279509', 'Technology',  'No Starch Press',    2018, 3, 3),
('The Pragmatic Programmer',     'Andrew Hunt',          '9780135957059', 'Technology',  'Addison-Wesley',     2019, 2, 2),
('Shakespeare: Complete Works',  'William Shakespeare',  '9781603200424', 'Literature',  'Modern Library',     2007, 2, 2),
('The Waste Land and Other Poems','T. S. Eliot',         '9780571097128', 'Literature',  'Faber & Faber',      1922, 2, 2),
('Long Walk to Freedom',         'Nelson Mandela',       '9780316548182', 'Biography',   'Back Bay Books',     1994, 3, 3);

-- ------------------------------------------------------------
-- SAMPLE DATA: 15 students
-- ------------------------------------------------------------
insert into students (admission_no, full_name, class, email, phone) values
('ADM/001', 'Brian Otieno',      'Form 1', 'brian.otieno@school.ac.ke',   '0712345001'),
('ADM/002', 'Amina Hassan',      'Form 1', 'amina.hassan@school.ac.ke',   '0712345002'),
('ADM/003', 'Kevin Mwangi',      'Form 1', 'kevin.mwangi@school.ac.ke',   '0712345003'),
('ADM/004', 'Faith Wanjiku',     'Form 2', 'faith.wanjiku@school.ac.ke',  '0712345004'),
('ADM/005', 'Collins Kiprotich', 'Form 2', 'collins.kip@school.ac.ke',    '0712345005'),
('ADM/006', 'Mercy Achieng',     'Form 2', 'mercy.achieng@school.ac.ke',  '0712345006'),
('ADM/007', 'Daniel Kimani',     'Form 2', 'daniel.kimani@school.ac.ke',  '0712345007'),
('ADM/008', 'Grace Njeri',       'Form 3', 'grace.njeri@school.ac.ke',    '0712345008'),
('ADM/009', 'Samuel Barasa',     'Form 3', 'samuel.barasa@school.ac.ke',  '0712345009'),
('ADM/010', 'Zawadi Mutiso',     'Form 3', 'zawadi.mutiso@school.ac.ke',  '0712345010'),
('ADM/011', 'Peter Njoroge',     'Form 3', 'peter.njoroge@school.ac.ke',  '0712345011'),
('ADM/012', 'Cynthia Auma',      'Form 4', 'cynthia.auma@school.ac.ke',   '0712345012'),
('ADM/013', 'Ibrahim Yusuf',     'Form 4', 'ibrahim.yusuf@school.ac.ke',  '0712345013'),
('ADM/014', 'Naomi Chebet',      'Form 4', 'naomi.chebet@school.ac.ke',   '0712345014'),
('ADM/015', 'Victor Omondi',     'Form 4', 'victor.omondi@school.ac.ke',  '0712345015');

-- ------------------------------------------------------------
-- SAMPLE DATA: 10 borrowings
-- Mix of currently borrowed, returned on time, returned late (fine)
-- and overdue. Triggers keep available_copies correct automatically.
-- ------------------------------------------------------------

-- 4 currently borrowed (not yet due)
insert into borrowings (book_id, student_id, issue_date, due_date)
select b.id, s.id, current_date - 3, current_date + 11
from books b, students s where b.isbn = '9780385474542' and s.admission_no = 'ADM/001';

insert into borrowings (book_id, student_id, issue_date, due_date)
select b.id, s.id, current_date - 5, current_date + 9
from books b, students s where b.isbn = '9780553380163' and s.admission_no = 'ADM/004';

insert into borrowings (book_id, student_id, issue_date, due_date)
select b.id, s.id, current_date - 1, current_date + 13
from books b, students s where b.isbn = '9780132350884' and s.admission_no = 'ADM/008';

insert into borrowings (book_id, student_id, issue_date, due_date)
select b.id, s.id, current_date - 7, current_date + 7
from books b, students s where b.isbn = '9780062316097' and s.admission_no = 'ADM/012';

-- 3 overdue (due date has passed, still not returned)
insert into borrowings (book_id, student_id, issue_date, due_date)
select b.id, s.id, current_date - 20, current_date - 6
from books b, students s where b.isbn = '9780451526342' and s.admission_no = 'ADM/002';

insert into borrowings (book_id, student_id, issue_date, due_date)
select b.id, s.id, current_date - 30, current_date - 16
from books b, students s where b.isbn = '9780679728146' and s.admission_no = 'ADM/009';

insert into borrowings (book_id, student_id, issue_date, due_date)
select b.id, s.id, current_date - 18, current_date - 4
from books b, students s where b.isbn = '9781593279509' and s.admission_no = 'ADM/013';

-- 2 returned on time (no fine)
insert into borrowings (book_id, student_id, issue_date, due_date)
select b.id, s.id, current_date - 40, current_date - 26
from books b, students s where b.isbn = '9780345539435' and s.admission_no = 'ADM/005';

insert into borrowings (book_id, student_id, issue_date, due_date)
select b.id, s.id, current_date - 35, current_date - 21
from books b, students s where b.isbn = '9780316548182' and s.admission_no = 'ADM/014';

-- 1 returned late (fine = 5 days x 10 = 50)
insert into borrowings (book_id, student_id, issue_date, due_date)
select b.id, s.id, current_date - 45, current_date - 31
from books b, students s where b.isbn = '9780199291151' and s.admission_no = 'ADM/006';

-- Now mark the last three as returned. The trigger returns the copies
-- to the shelf and sets status = 'returned'.
update borrowings set return_date = current_date - 28
 where due_date = current_date - 26 and return_date is null;

update borrowings set return_date = current_date - 22
 where due_date = current_date - 21 and return_date is null;

update borrowings set return_date = current_date - 26, fine_amount = 50
 where due_date = current_date - 31 and return_date is null;

-- Quick check: every book should satisfy the copies_check constraint.
-- select title, total_copies, available_copies from books order by title;
