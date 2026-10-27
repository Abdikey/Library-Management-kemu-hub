/* ============================================================
   CONFIGURATION
   ------------------------------------------------------------
   This is the ONLY file you need to change to connect the app
   to your own Supabase project.

   1. Open your Supabase project.
   2. Go to Project Settings -> API.
   3. Copy the "Project URL" into SUPABASE_URL below.
   4. Copy the "anon public" key into SUPABASE_ANON_KEY below.
   ============================================================ */

export const SUPABASE_URL = "https://tkysqvuzwhjaunxwhhau.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_6PFpSs1hZ9nC7Mt526nBRA_n2wOQvsj";

/* ---------- Library rules (change these if your school differs) ---------- */
export const LOAN_DAYS = 14; // how many days a student may keep a book
export const FINE_PER_DAY = 10; // money charged for each late day
export const MAX_BOOKS_PER_STUDENT = 3; // how many books one student may hold
export const CURRENCY = "KES"; // currency shown next to fines
export const PAGE_SIZE = 10; // rows shown per table page

/* ---------- Supabase client ----------
   The Supabase library is loaded from a CDN in every HTML page, so it
   is available as the global variable `supabase`. We rename our client
   to `db` so it is easy to read: db.from("books")... */
export const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Is the app still using the placeholder keys? */
export const IS_CONFIGURED =
  !SUPABASE_URL.includes("YOUR-PROJECT-ID") &&
  !SUPABASE_ANON_KEY.includes("YOUR-ANON");
