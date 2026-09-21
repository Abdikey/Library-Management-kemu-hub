/* Documentation page: only needs the shared sidebar and print button. */
import { initLayout } from "./app.js";
import { LOAN_DAYS, FINE_PER_DAY, MAX_BOOKS_PER_STUDENT, CURRENCY } from "./config.js";

initLayout("documentation.html");

document.getElementById("print-btn").addEventListener("click", () => window.print());

// Show the rules exactly as they are set in js/config.js.
document.getElementById("rule-loan").textContent = `${LOAN_DAYS} days`;
document.getElementById("rule-fine").textContent = `${CURRENCY} ${FINE_PER_DAY} per late day`;
document.getElementById("rule-max").textContent = `${MAX_BOOKS_PER_STUDENT} books per student`;
