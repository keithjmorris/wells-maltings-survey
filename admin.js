// admin.js â€” Firebase auth + Firestore read + CSV export
import { initializeApp }         from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, orderBy, query }
                                 from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
                                 from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig }        from "./firebase-config.js";

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
const csvBtn       = document.getElementById("csvBtn");

let allEventResponses = [];
let allCafeResponses  = [];
let activeTab = "events";

// â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
onAuthStateChanged(auth, user => {
  if (user) {
    loginScreen.style.display = "none";
    adminScreen.style.display = "block";
    adminEmailEl.textContent  = user.email;
    loadAllResponses();
  } else {
    loginScreen.style.display = "flex";
    adminScreen.style.display = "none";
  }
});

loginBtn.addEventListener("click", async () => {
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  loginError.style.display = "none";
  loginBtn.disabled        = true;
  loginBtn.textContent     = "Signing inâ€¦";
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent   = friendlyAuthError(err.code);
    loginError.style.display = "block";
    loginBtn.disabled        = false;
    loginBtn.textContent     = "Sign in";
  }
});

document.getElementById("loginPassword").addEventListener("keydown", e => {
  if (e.key === "Enter") loginBtn.click();
});

signOutBtn.addEventListener("click", () => signOut(auth));

// â”€â”€ Load both collections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadAllResponses() {
  loadingMsg.style.display = "block";
  try {
    const [eventSnap, cafeSnap] = await Promise.all([
      getDocs(query(collection(db, "responses"),      orderBy("submittedAt", "desc"))),
      getDocs(query(collection(db, "cafe_responses"), orderBy("submittedAt", "desc")))
    ]);
    allEventResponses = eventSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    allCafeResponses  = cafeSnap.docs.map(d =>  ({ id: d.id, ...d.data() }));
    loadingMsg.style.display = "none";
    renderActiveTab();
  } catch (err) {
    console.error("Firestore read failed:", err);
    loadingMsg.textContent = "Failed to load responses. Check your connection and try refreshing.";
  }
}

// â”€â”€ Tab switching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.getElementById("tabEvents").addEventListener("click", () => switchTab("events"));
document.getElementById("tabCafe").addEventListener("click",   () => switchTab("cafe"));

function switchTab(tab) {
  activeTab = tab;
  document.getElementById("tabEvents").classList.toggle("tab-active", tab === "events");
  document.getElementById("tabCafe").classList.toggle("tab-active",   tab === "cafe");
  document.getElementById("eventFilters").style.display = tab === "events" ? "flex" : "none";
  document.getElementById("cafeFilters").style.display  = tab === "cafe"   ? "flex" : "none";
  renderActiveTab();
}

function renderActiveTab() {
  if (activeTab === "events") {
    renderEventStats();
    renderEventResponses();
  } else {
    renderCafeStats();
    renderCafeResponses();
  }
}

// â”€â”€ EVENT stats & responses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderEventStats() {
  const total  = allEventResponses.length;
  const avg    = total
    ? (allEventResponses.reduce((s, r) => s + (r.rating || 0), 0) / total).toFixed(1)
    : null;
  const events = new Set(allEventResponses.map(r => r.eventName)).size;
  const emails = allEventResponses.filter(r => r.email).length;

  document.getElementById("statTotal").textContent  = total;
  document.getElementById("statAvg").textContent    = avg ? avg + " \u2605" : "\u2014";
  document.getElementById("statEvents").textContent = events;
  document.getElementById("statEmails").textContent = emails;
  document.getElementById("statLabel3").textContent = "Events covered";
}

function renderEventResponses() {
  const evFilter = document.getElementById("filterEvent").value.toLowerCase();
  const rtFilter = document.getElementById("filterRating").value;
  const list     = document.getElementById("responseList");

  const filtered = allEventResponses.filter(r =>
    (!evFilter || (r.eventName || "").toLowerCase().includes(evFilter)) &&
    (!rtFilter || String(r.rating) === rtFilter)
  );

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">No responses match this filter.</div>';
    return;
  }

  list.innerHTML = filtered.map(r => {
    const date  = formatDate(r.submittedAt);
    const stars = renderStars(r.rating);
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
          ${opt("Heard via",       r.heard)}
          ${opt("Visit frequency", r.visitFreq)}
          ${opt("Age group",       r.ageGroup)}
          ${opt("Postcode",        r.postcode)}
          ${opt("Email",           r.email)}
          ${opt("Mailing list",    r.mailingList)}
          ${full("Accessibility",  r.accessibility)}
        </div>
      </div>`;
  }).join("");
}

document.getElementById("filterEvent").addEventListener("input",   renderEventResponses);
document.getElementById("filterRating").addEventListener("change", renderEventResponses);

// â”€â”€ CAFÃ‰ stats & responses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderCafeStats() {
  const total   = allCafeResponses.length;
  const avg     = total
    ? (allCafeResponses.reduce((s, r) => s + (r.overallRating || 0), 0) / total).toFixed(1)
    : null;
  const alcohol = allCafeResponses.filter(r => r.alcohol === "Yes").length;
  const recommend = allCafeResponses.filter(r =>
    r.recommend === "Definitely" || r.recommend === "Probably"
  ).length;

  document.getElementById("statTotal").textContent  = total;
  document.getElementById("statAvg").textContent    = avg ? avg + " \u2605" : "\u2014";
  document.getElementById("statEvents").textContent = total ? Math.round((recommend / total) * 100) + "%" : "\u2014";
  document.getElementById("statEmails").textContent = alcohol;
  document.getElementById("statLabel3").textContent = "Would recommend";
}

function renderCafeResponses() {
  const dtFilter = document.getElementById("filterCafeDate").value;
  const todFilter = document.getElementById("filterTimeOfDay").value;
  const list      = document.getElementById("responseList");

  const filtered = allCafeResponses.filter(r =>
    (!dtFilter  || r.visitDate === dtFilter) &&
    (!todFilter || r.timeOfDay === todFilter)
  );

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">No cafÃ© responses match this filter.</div>';
    return;
  }

  list.innerHTML = filtered.map(r => {
    const date = formatDate(r.submittedAt);
    return `
      <div class="response-card">
        <div class="rc-meta">
          <span>&#x2615; CafÃ©</span>
          <span>&#x1F4C5; ${r.visitDate || "â€”"}</span>
          <span class="rc-tag">${r.timeOfDay || "â€”"}</span>
          <span class="rc-stars">${renderStars(r.overallRating)}</span>
          <span class="rc-date">${date}</span>
        </div>
        ${r.comments ? `<div class="rc-label">Comments</div><div class="rc-value">${r.comments}</div>` : ""}
        <div class="rc-grid" style="margin-top:${r.comments ? "8px" : "0"}">
          ${opt("Had",             r.had)}
          ${opt("Alcoholic drink", r.alcohol)}
          ${opt("Food choice",     r.foodChoice)}
          ${opt("Wait time",       r.waitTime)}
          ${opt("Food rating",     r.foodRating    ? renderStars(r.foodRating)    : "")}
          ${opt("Service rating",  r.serviceRating ? renderStars(r.serviceRating) : "")}
          ${opt("Would recommend", r.recommend)}
        </div>
      </div>`;
  }).join("");
}

document.getElementById("filterCafeDate").addEventListener("input",   renderCafeResponses);
document.getElementById("filterTimeOfDay").addEventListener("change", renderCafeResponses);

// â”€â”€ CSV export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
csvBtn.addEventListener("click", () => {
  if (activeTab === "events") exportEventCSV();
  else exportCafeCSV();
});

function exportEventCSV() {
  if (!allEventResponses.length) { alert("No event responses to export."); return; }
  const headers = ["ID","Submitted","Event date","Event name","Rating","Comments","Suggestions",
                   "Heard via","Age group","Visit frequency","Postcode","Email","Mailing list","Accessibility"];
  const rows = allEventResponses.map(r => [
    r.id, isoDate(r.submittedAt), r.eventDate, r.eventName, r.rating,
    r.comments, r.suggestions, r.heard, r.ageGroup,
    r.visitFreq, r.postcode, r.email, r.mailingList, r.accessibility
  ]);
  downloadCSV(rows, headers, "wells-maltings-events");
}

function exportCafeCSV() {
  if (!allCafeResponses.length) { alert("No cafÃ© responses to export."); return; }
  const headers = ["ID","Submitted","Visit date","Time of day","Overall rating","Food rating",
                   "Service rating","Had","Alcoholic drink","Food choice","Wait time","Comments","Would recommend"];
  const rows = allCafeResponses.map(r => [
    r.id, isoDate(r.submittedAt), r.visitDate, r.timeOfDay, r.overallRating,
    r.foodRating, r.serviceRating, r.had, r.alcohol,
    r.foodChoice, r.waitTime, r.comments, r.recommend
  ]);
  downloadCSV(rows, headers, "wells-maltings-cafe");
}

function downloadCSV(rows, headers, filename) {
  const csv  = [headers, ...rows]
    .map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderStars(n) {
  return "\u2605".repeat(n || 0) + "\u2606".repeat(5 - (n || 0));
}

function formatDate(ts) {
  return ts?.toDate
    ? ts.toDate().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "â€”";
}

function isoDate(ts) {
  return ts?.toDate ? ts.toDate().toISOString() : "";
}

function opt(label, val) {
  return val ? `<div><div class="rc-label">${label}</div><div class="rc-value">${val}</div></div>` : "";
}

function full(label, val) {
  return val ? `<div style="grid-column:1/-1"><div class="rc-label">${label}</div><div class="rc-value">${val}</div></div>` : "";
}

function friendlyAuthError(code) {
  switch (code) {
    case "auth/invalid-email":      return "Please enter a valid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "Email or password is incorrect.";
    case "auth/too-many-requests":  return "Too many attempts. Please wait a moment and try again.";
    default:                        return "Sign-in failed. Please try again.";
  }
}