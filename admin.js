// admin.js â€” Firebase auth + Firestore read + CSV export
import { initializeApp }         from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, orderBy, query }
                                 from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
                                 from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig }        from "./firebase-config.js";

// â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// â”€â”€ DOM refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const loginScreen  = document.getElementById("loginScreen");
const adminScreen  = document.getElementById("adminScreen");
const loginError   = document.getElementById("loginError");
const loginBtn     = document.getElementById("loginBtn");
const signOutBtn   = document.getElementById("signOutBtn");
const adminEmailEl = document.getElementById("adminEmail");
const loadingMsg   = document.getElementById("loadingMsg");
const responseList = document.getElementById("responseList");
const csvBtn       = document.getElementById("csvBtn");
const filterEvent  = document.getElementById("filterEvent");
const filterRating = document.getElementById("filterRating");

let allResponses = [];

// â”€â”€ Auth state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
onAuthStateChanged(auth, user => {
  if (user) {
    loginScreen.style.display  = "none";
    adminScreen.style.display  = "block";
    adminEmailEl.textContent   = user.email;
    loadResponses();
  } else {
    loginScreen.style.display  = "flex";
    adminScreen.style.display  = "none";
  }
});

// â”€â”€ Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
loginBtn.addEventListener("click", async () => {
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  loginError.style.display = "none";
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing inâ€¦";

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = friendlyAuthError(err.code);
    loginError.style.display = "block";
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign in";
  }
});

document.getElementById("loginPassword").addEventListener("keydown", e => {
  if (e.key === "Enter") loginBtn.click();
});

signOutBtn.addEventListener("click", () => signOut(auth));

// â”€â”€ Load responses from Firestore â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadResponses() {
  loadingMsg.style.display = "block";
  responseList.innerHTML   = "";

  try {
    const q    = query(collection(db, "responses"), orderBy("submittedAt", "desc"));
    const snap = await getDocs(q);
    allResponses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderStats();
    renderResponses();
    loadingMsg.style.display = "none";
  } catch (err) {
    console.error("Firestore read failed:", err);
    loadingMsg.textContent = "Failed to load responses. Check your connection and try refreshing.";
  }
}

// â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderStats() {
  const total  = allResponses.length;
  const avg    = total
    ? (allResponses.reduce((sum, r) => sum + (r.rating || 0), 0) / total).toFixed(1)
    : "â€”";
  const events = new Set(allResponses.map(r => r.eventName)).size;
  const emails = allResponses.filter(r => r.email).length;

  document.getElementById("statTotal").textContent  = total;
  document.getElementById("statAvg").textContent    = total ? avg + " â˜…" : "â€”";
  document.getElementById("statEvents").textContent = events;
  document.getElementById("statEmails").textContent = emails;
}

// â”€â”€ Render response cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderResponses() {
  const evFilter = filterEvent.value.toLowerCase();
  const rtFilter = filterRating.value;

  const filtered = allResponses.filter(r =>
    (!evFilter || (r.eventName || "").toLowerCase().includes(evFilter)) &&
    (!rtFilter || String(r.rating) === rtFilter)
  );

  if (!filtered.length) {
    responseList.innerHTML = '<div class="empty-state">No responses match this filter.</div>';
    return;
  }

  responseList.innerHTML = filtered.map(r => {
    const date      = r.submittedAt?.toDate
      ? r.submittedAt.toDate().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "â€”";
    const stars     = "â˜…".repeat(r.rating || 0) + "â˜†".repeat(5 - (r.rating || 0));

    const optField  = (label, val) => val
      ? `<div><div class="rc-label">${label}</div><div class="rc-value">${val}</div></div>`
      : "";
    const fullField = (label, val) => val
      ? `<div style="grid-column:1/-1"><div class="rc-label">${label}</div><div class="rc-value">${val}</div></div>`
      : "";

    return `
      <div class="response-card">
        <div class="rc-meta">
          <span>&#x1F4C5; ${r.eventDate || "â€”"}</span>
          <span>&#x1F3AD; ${r.eventName || "â€”"}</span>
          <span class="rc-stars">${stars}</span>
          <span class="rc-date">${date}</span>
        </div>
        ${r.comments    ? `<div class="rc-label">Comments</div><div class="rc-value">${r.comments}</div>` : ""}
        ${r.suggestions ? `<div class="rc-label">Suggestions</div><div class="rc-value">${r.suggestions}</div>` : ""}
        <div class="rc-grid" style="margin-top:${r.comments || r.suggestions ? "8px" : "0"}">
          ${optField("Heard via",        r.heard)}
          ${optField("Visit frequency",  r.visitFreq)}
          ${optField("Age group",        r.ageGroup)}
          ${optField("Postcode",         r.postcode)}
          ${optField("Email",            r.email)}
          ${optField("Mailing list",     r.mailingList)}
          ${fullField("Accessibility",   r.accessibility)}
        </div>
      </div>
    `;
  }).join("");
}

filterEvent.addEventListener("input",  renderResponses);
filterRating.addEventListener("change", renderResponses);

// â”€â”€ CSV export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
csvBtn.addEventListener("click", () => {
  if (!allResponses.length) { alert("No responses to export."); return; }

  const headers = [
    "ID", "Submitted at", "Event date", "Event name", "Rating",
    "Comments", "Suggestions", "Heard via", "Age group",
    "Visit frequency", "Postcode", "Email", "Mailing list", "Accessibility"
  ];

  const rows = allResponses.map(r => {
    const submitted = r.submittedAt?.toDate
      ? r.submittedAt.toDate().toISOString()
      : "";
    return [
      r.id, submitted, r.eventDate, r.eventName, r.rating,
      r.comments, r.suggestions, r.heard, r.ageGroup,
      r.visitFreq, r.postcode, r.email, r.mailingList, r.accessibility
    ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`);
  });

  const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `wells-maltings-responses-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// â”€â”€ Friendly auth errors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function friendlyAuthError(code) {
  switch (code) {
    case "auth/invalid-email":        return "Please enter a valid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":   return "Email or password is incorrect.";
    case "auth/too-many-requests":    return "Too many attempts. Please wait a moment and try again.";
    default:                          return "Sign-in failed. Please try again.";
  }
}