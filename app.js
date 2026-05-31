// app.js â€” survey form logic + Firestore write
import { initializeApp }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp }
                               from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig }      from "./firebase-config.js";

// â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// â”€â”€ DOM refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const form        = document.getElementById("surveyForm");
const submitBtn   = document.getElementById("submitBtn");
const formError   = document.getElementById("formError");
const successMsg  = document.getElementById("successMsg");
const ratingInput = document.getElementById("rating");
const stars       = document.querySelectorAll(".star");

// â”€â”€ QR code pre-fill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Link format: https://yoursite.com/?event=Jazz+at+the+Maltings&date=2026-06-15
const params = new URLSearchParams(window.location.search);
if (params.get("event")) {
  document.getElementById("eventName").value = params.get("event");
  document.getElementById("qrNotice").style.display = "block";
}
if (params.get("date")) {
  document.getElementById("eventDate").value = params.get("date");
}

// â”€â”€ Star rating â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
stars.forEach(star => {
  star.addEventListener("click", () => {
    const val = parseInt(star.dataset.value);
    ratingInput.value = val;
    stars.forEach(s => s.classList.toggle("lit", parseInt(s.dataset.value) <= val));
  });
  star.addEventListener("mouseenter", () => {
    const val = parseInt(star.dataset.value);
    stars.forEach(s => s.classList.toggle("lit", parseInt(s.dataset.value) <= val));
  });
});

document.getElementById("starRow").addEventListener("mouseleave", () => {
  const current = parseInt(ratingInput.value);
  stars.forEach(s => s.classList.toggle("lit", parseInt(s.dataset.value) <= current));
});

// â”€â”€ Chip toggles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    if (chip.classList.contains("single")) {
      // radio-style: deselect siblings in same group
      const group = chip.dataset.group;
      document.querySelectorAll(`.chip[data-group="${group}"]`)
              .forEach(c => c.classList.remove("selected"));
    }
    chip.classList.toggle("selected");
  });
});

// â”€â”€ Form submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const eventDate = document.getElementById("eventDate").value.trim();
  const eventName = document.getElementById("eventName").value.trim();
  const rating    = parseInt(ratingInput.value);

  if (!eventDate || !eventName) {
    showError("Please fill in the event name and date.");
    return;
  }
  if (!rating) {
    showError("Please select a star rating.");
    return;
  }

  const heard = Array.from(document.querySelectorAll('[data-group="heard"].selected'))
                     .map(c => c.textContent).join("; ");
  const mailing = document.querySelector('[data-group="mailing"].selected')?.textContent || "";

  const response = {
    submittedAt:   serverTimestamp(),
    eventDate,
    eventName,
    rating,
    comments:      document.getElementById("comments").value.trim(),
    suggestions:   document.getElementById("suggestions").value.trim(),
    heard,
    ageGroup:      document.getElementById("ageGroup").value,
    visitFreq:     document.getElementById("visitFreq").value,
    postcode:      document.getElementById("postcode").value.trim().toUpperCase(),
    email:         document.getElementById("email").value.trim().toLowerCase(),
    mailingList:   mailing,
    accessibility: document.getElementById("accessibility").value.trim()
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Submittingâ€¦";

  try {
    await addDoc(collection(db, "responses"), response);
    form.style.display = "none";
    successMsg.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error("Firestore write failed:", err);
    showError("Sorry, there was a problem submitting your response. Please try again.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit feedback";
  }
});

function showError(msg) {
  formError.textContent = msg;
  formError.style.display = "block";
  formError.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideError() {
  formError.style.display = "none";
}