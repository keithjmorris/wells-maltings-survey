// events.js — Maltings audience survey logic + Firestore write
import { initializeApp }      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp }
                              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig }     from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Chip toggles ───────────────────────────────────────────
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

// ── 1-4 scale buttons ──────────────────────────────────────
document.querySelectorAll(".scale-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const group = btn.dataset.group;
    document.querySelectorAll(`.scale-btn[data-group="${group}"]`)
            .forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    // Store value in hidden input
    const hiddenId = group + "Rating";
    const hidden = document.getElementById(hiddenId);
    if (hidden) hidden.value = btn.dataset.value;
  });
});

// ── Helper: get selected chips ─────────────────────────────
function getSelected(group, multi = false) {
  const els = document.querySelectorAll(`.chip[data-group="${group}"].selected`);
  if (multi) return Array.from(els).map(e => e.textContent).join("; ");
  return els[0]?.textContent || "";
}

// ── Submit ─────────────────────────────────────────────────
const form       = document.getElementById("eventsForm");
const submitBtn  = document.getElementById("submitBtn");
const formError  = document.getElementById("formError");
const successMsg = document.getElementById("successMsg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const overallRating = document.getElementById("overallRating").value;
  if (!overallRating) {
    showError("Please rate your overall experience.");
    return;
  }

  const entry = {
    type:               "audience_survey",
    submittedAt:        serverTimestamp(),
    eventType:          getSelected("eventType"),
    recency:            getSelected("recency"),
    eventTime:          document.getElementById("eventTime").value || "",
    companion:          getSelected("companion"),
    overallRating:      parseInt(overallRating),
    overallReason:      document.getElementById("overallReason").value.trim(),
    presentationRating: parseInt(document.getElementById("presentationRating").value) || null,
    presentationReason: document.getElementById("presentationReason").value.trim(),
    pricingRating:      parseInt(document.getElementById("pricingRating").value) || null,
    pricingReason:      document.getElementById("pricingReason").value.trim(),
    cafeRating:         parseInt(document.getElementById("cafeRating").value) || null,
    cafeReason:         document.getElementById("cafeReason").value.trim(),
    heard:              getSelected("heard", true),
    visitFreq:          getSelected("visitFreq"),
    visitFreqReason:    document.getElementById("visitFreqReason").value.trim(),
    moreOf:             getSelected("moreOf", true),
    suggestions:        document.getElementById("suggestions").value.trim(),
    disability:         getSelected("disability", true),
    economic:           getSelected("economic"),
    postcode:           document.getElementById("postcode").value.trim().toUpperCase(),
    ageGroup:           document.getElementById("ageGroup").value,
  };

  submitBtn.disabled    = true;
  submitBtn.textContent = "Submitting…";

  try {
    await addDoc(collection(db, "audience_surveys"), entry);
    form.style.display       = "none";
    successMsg.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error("Firestore write failed:", err);
    showError("Sorry, there was a problem submitting your survey. Please try again.");
    submitBtn.disabled    = false;
    submitBtn.textContent = "Submit survey";
  }
});

function showError(msg) {
  formError.textContent   = msg;
  formError.style.display = "block";
  formError.scrollIntoView({ behavior: "smooth", block: "center" });
}
function hideError() {
  formError.style.display = "none";
}
