// cafe.js â€” cafÃ© survey logic + Firestore write
import { initializeApp }      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp }
                              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig }     from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// â”€â”€ Capture time of day silently on page load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const loadTime  = new Date();
const visitDate = loadTime.toISOString().slice(0, 10);
const visitHour = loadTime.getHours();

function timeOfDayLabel(hour) {
  if (hour < 12) return "Morning";
  if (hour < 14) return "Lunchtime";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

// â”€â”€ Allow URL params to override date (for testing) â”€â”€â”€â”€â”€â”€â”€
const params = new URLSearchParams(window.location.search);
const recordDate = params.get("date") || visitDate;

// â”€â”€ Star rating helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initStarRow(rowId, hiddenId) {
  const row    = document.getElementById(rowId);
  const hidden = document.getElementById(hiddenId);
  const stars  = row.querySelectorAll(".star");

  stars.forEach(star => {
    star.addEventListener("click", () => {
      const val = parseInt(star.dataset.value);
      hidden.value = val;
      stars.forEach(s => s.classList.toggle("lit", parseInt(s.dataset.value) <= val));
    });
    star.addEventListener("mouseenter", () => {
      const val = parseInt(star.dataset.value);
      stars.forEach(s => s.classList.toggle("lit", parseInt(s.dataset.value) <= val));
    });
  });

  row.addEventListener("mouseleave", () => {
    const current = parseInt(hidden.value);
    stars.forEach(s => s.classList.toggle("lit", parseInt(s.dataset.value) <= current));
  });
}

initStarRow("starRow",        "overallRating");
initStarRow("foodStarRow",    "foodRating");
initStarRow("serviceStarRow", "serviceRating");

// â”€â”€ Chip toggles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    if (chip.classList.contains("single")) {
      const group = chip.dataset.group;
      document.querySelectorAll(`.chip[data-group="${group}"]`)
              .forEach(c => c.classList.remove("selected"));
    }
    chip.classList.toggle("selected");
  });
});

// â”€â”€ Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const form      = document.getElementById("cafeForm");
const submitBtn = document.getElementById("submitBtn");
const formError = document.getElementById("formError");
const successMsg = document.getElementById("successMsg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const overallRating = parseInt(document.getElementById("overallRating").value);
  if (!overallRating) {
    showError("Please select an overall star rating.");
    return;
  }

  const had       = Array.from(document.querySelectorAll('[data-group="had"].selected')).map(c => c.textContent).join("; ");
  const alcohol   = document.querySelector('[data-group="alcohol"].selected')?.textContent   || "";
  const choice    = document.querySelector('[data-group="choice"].selected')?.textContent    || "";
  const wait      = document.querySelector('[data-group="wait"].selected')?.textContent      || "";
  const recommend = document.querySelector('[data-group="recommend"].selected')?.textContent || "";

  const entry = {
    type:          "cafe",
    submittedAt:   serverTimestamp(),
    visitDate:     recordDate,
    visitHour,
    timeOfDay:     timeOfDayLabel(visitHour),
    overallRating,
    foodRating:    parseInt(document.getElementById("foodRating").value)    || null,
    serviceRating: parseInt(document.getElementById("serviceRating").value) || null,
    had,
    alcohol,
    foodChoice:    choice,
    waitTime:      wait,
    comments:      document.getElementById("comments").value.trim(),
    recommend
  };

  submitBtn.disabled    = true;
  submitBtn.textContent = "Submittingâ€¦";

  try {
    await addDoc(collection(db, "cafe_responses"), entry);
    form.style.display       = "none";
    successMsg.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error("Firestore write failed:", err);
    showError("Sorry, there was a problem submitting your feedback. Please try again.");
    submitBtn.disabled    = false;
    submitBtn.textContent = "Submit feedback";
  }
});

function showError(msg) {
  formError.textContent    = msg;
  formError.style.display  = "block";
  formError.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideError() {
  formError.style.display = "none";
}