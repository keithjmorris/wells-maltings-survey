// app.js — survey form logic + Firestore write
import { initializeApp }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, orderBy, query, serverTimestamp }
                               from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig }      from "./firebase-config.js";

// ── Init ──────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── DOM refs ──────────────────────────────────────────────
const form        = document.getElementById("surveyForm");
const submitBtn   = document.getElementById("submitBtn");
const formError   = document.getElementById("formError");
const successMsg  = document.getElementById("successMsg");
const ratingInput = document.getElementById("rating");
const stars       = document.querySelectorAll(".star");
const eventSelect = document.getElementById("eventSelect");
const otherWrap   = document.getElementById("otherEventWrap");
const otherInput  = document.getElementById("otherEventName");
const eventDate   = document.getElementById("eventDate");

// ── Load events from Firestore into dropdown ──────────────
async function loadEvents() {
  try {
    const q    = query(collection(db, "events"), orderBy("sortDate", "asc"));
    const snap = await getDocs(q);

    snap.docs.forEach(doc => {
      const data = doc.data();
      const opt  = document.createElement("option");
      opt.value        = doc.id;
      opt.textContent  = data.label;
      opt.dataset.date = data.date || "";
      eventSelect.appendChild(opt);
    });

    // Add Other option at the end
    const other = document.createElement("option");
    other.value       = "__other__";
    other.textContent = "Other (please specify)";
    eventSelect.appendChild(other);

  } catch (err) {
    console.error("Failed to load events:", err);
    // Fall back gracefully — show free text only
    eventSelect.style.display = "none";
    otherWrap.style.display   = "block";
  }
}

loadEvents();

// ── Event selection handler ───────────────────────────────
eventSelect.addEventListener("change", () => {
  const selected = eventSelect.options[eventSelect.selectedIndex];

  if (eventSelect.value === "__other__") {
    otherWrap.style.display = "block";
    otherInput.required     = true;
    eventDate.value         = "";
  } else if (eventSelect.value === "") {
    otherWrap.style.display = "none";
    otherInput.required     = false;
    eventDate.value         = "";
  } else {
    otherWrap.style.display = "none";
    otherInput.required     = false;
    // Auto-fill date if stored with the event
    if (selected.dataset.date) {
      eventDate.value = selected.dataset.date;
    } else {
      eventDate.value = "";
    }
  }
});

// ── QR code pre-fill ──────────────────────────────────────
const params = new URLSearchParams(window.location.search);
if (params.get("event")) {
  // Pre-select matching event in dropdown if possible
  const opts = Array.from(eventSelect.options);
  const match = opts.find(o => o.textContent.toLowerCase().includes(params.get("event").toLowerCase()));
  if (match) {
    eventSelect.value = match.value;
    eventSelect.dispatchEvent(new Event("change"));
  } else {
    eventSelect.value = "__other__";
    otherWrap.style.display = "block";
    otherInput.value = params.get("event");
  }
  document.getElementById("qrNotice").style.display = "block";
}
if (params.get("date")) {
  eventDate.value = params.get("date");
}

// ── Star rating ───────────────────────────────────────────
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

// ── Chip toggles ──────────────────────────────────────────
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

// ── Form submit ───────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  // Resolve event name
  let eventName = "";
  if (eventSelect.value === "__other__") {
    eventName = otherInput.value.trim();
  } else if (eventSelect.value !== "") {
    eventName = eventSelect.options[eventSelect.selectedIndex].textContent;
  }

  const dateVal  = eventDate.value.trim();
  const rating   = parseInt(ratingInput.value);

  if (!eventName) {
    showError("Please select or enter an event name.");
    return;
  }
  if (!dateVal) {
    showError("Please enter the date of the event.");
    return;
  }
  if (!rating) {
    showError("Please select a star rating.");
    return;
  }

  const heard   = Array.from(document.querySelectorAll('[data-group="heard"].selected'))
                       .map(c => c.textContent).join("; ");
  const mailing = document.querySelector('[data-group="mailing"].selected')?.textContent || "";

  const response = {
    submittedAt:   serverTimestamp(),
    eventDate:     dateVal,
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

  submitBtn.disabled    = true;
  submitBtn.textContent = "Submitting…";

  try {
    await addDoc(collection(db, "responses"), response);
    form.style.display       = "none";
    successMsg.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error("Firestore write failed:", err);
    showError("Sorry, there was a problem submitting your response. Please try again.");
    submitBtn.disabled    = false;
    submitBtn.textContent = "Submit feedback";
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
