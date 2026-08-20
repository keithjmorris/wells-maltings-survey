// admin.js — Firebase auth + Firestore read + CSV export + event management
import { initializeApp }         from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, orderBy, query, serverTimestamp }
                                 from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
                                 from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig }        from "./firebase-config.js";

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ── DOM refs ──────────────────────────────────────────────
const loginScreen  = document.getElementById("loginScreen");
const adminScreen  = document.getElementById("adminScreen");
const loginError   = document.getElementById("loginError");
const loginBtn     = document.getElementById("loginBtn");
const signOutBtn   = document.getElementById("signOutBtn");
const adminEmailEl = document.getElementById("adminEmail");
const loadingMsg   = document.getElementById("loadingMsg");
const csvBtn       = document.getElementById("csvBtn");
const filterEvent  = document.getElementById("filterEvent");
const filterRating = document.getElementById("filterRating");
const addEventBtn  = document.getElementById("addEventBtn");
const newEventLabel= document.getElementById("newEventLabel");
const newEventDate = document.getElementById("newEventDate");
const eventListAdmin = document.getElementById("eventListAdmin");
const manageEvents = document.getElementById("manageEvents");

let allEventResponses = [];
let allCafeResponses  = [];
let activeTab = "events";

// ── Auth ──────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    loginScreen.style.display = "none";
    adminScreen.style.display = "block";
    adminEmailEl.textContent  = user.email;
    loadAllResponses();
    loadEventsAdmin();
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
  loginBtn.textContent     = "Signing in…";
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

// ── Load responses ────────────────────────────────────────
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

// ── Manage events ─────────────────────────────────────────
async function loadEventsAdmin() {
  try {
    const q    = query(collection(db, "events"), orderBy("sortDate", "asc"));
    const snap = await getDocs(q);
    renderEventList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error("Failed to load events:", err);
  }
}

function renderEventList(events) {
  if (!events.length) {
    eventListAdmin.innerHTML = '<div class="event-list-empty">No events yet — add one above.</div>';
    return;
  }
  eventListAdmin.innerHTML = events.map(e => `
    <div class="event-list-item">
      <span>
        ${e.label}
        ${e.date ? `<span class="event-date">${formatDateStr(e.date)}</span>` : ""}
      </span>
      <button class="btn-danger" onclick="deleteEvent('${e.id}')">Remove</button>
    </div>
  `).join("");
}

addEventBtn.addEventListener("click", async () => {
  const label = newEventLabel.value.trim();
  const date  = newEventDate.value;
  if (!label) { alert("Please enter an event name."); return; }

  addEventBtn.disabled    = true;
  addEventBtn.textContent = "Adding…";

  try {
    await addDoc(collection(db, "events"), {
      label,
      date:     date || "",
      sortDate: date || "9999-12-31",
      createdAt: serverTimestamp()
    });
    newEventLabel.value = "";
    newEventDate.value  = "";
    await loadEventsAdmin();
  } catch (err) {
    console.error("Failed to add event:", err);
    alert("Failed to add event. Please try again.");
  } finally {
    addEventBtn.disabled    = false;
    addEventBtn.textContent = "Add";
  }
});

// Global so inline onclick can reach it
window.deleteEvent = async (id) => {
  if (!confirm("Remove this event from the dropdown?")) return;
  try {
    await deleteDoc(doc(db, "events", id));
    await loadEventsAdmin();
  } catch (err) {
    console.error("Failed to delete event:", err);
    alert("Failed to remove event. Please try again.");
  }
};

// ── Tab switching ─────────────────────────────────────────
document.getElementById("tabEvents").addEventListener("click", () => switchTab("events"));
document.getElementById("tabCafe").addEventListener("click",   () => switchTab("cafe"));

function switchTab(tab) {
  activeTab = tab;
  document.getElementById("tabEvents").classList.toggle("tab-active", tab === "events");
  document.getElementById("tabCafe").classList.toggle("tab-active",   tab === "cafe");
  document.getElementById("eventFilters").style.display = tab === "events" ? "flex" : "none";
  document.getElementById("cafeFilters").style.display  = tab === "cafe"   ? "flex" : "none";
  manageEvents.style.display = tab === "events" ? "block" : "none";
  renderActiveTab();
}

function renderActiveTab() {
  if (activeTab === "events") { renderEventStats(); renderEventResponses(); }
  else                        { renderCafeStats();  renderCafeResponses();  }
}

// ── Event stats & responses ───────────────────────────────
function renderEventStats() {
  const total  = allEventResponses.length;
  const avg    = total ? (allEventResponses.reduce((s,r) => s+(r.rating||0),0)/total).toFixed(1) : null;
  const events = new Set(allEventResponses.map(r => r.eventName)).size;
  const emails = allEventResponses.filter(r => r.email).length;
  document.getElementById("statTotal").textContent  = total;
  document.getElementById("statAvg").textContent    = avg ? avg+" \u2605" : "\u2014";
  document.getElementById("statEvents").textContent = events;
  document.getElementById("statEmails").textContent = emails;
  document.getElementById("statLabel3").textContent = "Events covered";
  document.getElementById("statLabel4").textContent = "Emails collected";
}

function renderEventResponses() {
  const evFilter = filterEvent.value.toLowerCase();
  const rtFilter = filterRating.value;
  const list     = document.getElementById("responseList");
  const filtered = allEventResponses.filter(r =>
    (!evFilter || (r.eventName||"").toLowerCase().includes(evFilter)) &&
    (!rtFilter || String(r.rating) === rtFilter)
  );
  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">No responses match this filter.</div>';
    return;
  }
  list.innerHTML = filtered.map(r => `
    <div class="response-card">
      <div class="rc-meta">
        <span>&#x1F4C5; ${r.eventDate||"—"}</span>
        <span>&#x1F3AD; ${r.eventName||"—"}</span>
        <span class="rc-stars">${renderStars(r.rating)}</span>
        <span class="rc-date">${formatDate(r.submittedAt)}</span>
      </div>
      ${r.comments    ? `<div class="rc-label">Comments</div><div class="rc-value">${r.comments}</div>` : ""}
      ${r.suggestions ? `<div class="rc-label">Suggestions</div><div class="rc-value">${r.suggestions}</div>` : ""}
      <div class="rc-grid" style="margin-top:${r.comments||r.suggestions?"8px":"0"}">
        ${opt("Heard via",       r.heard)}
        ${opt("Visit frequency", r.visitFreq)}
        ${opt("Age group",       r.ageGroup)}
        ${opt("Postcode",        r.postcode)}
        ${opt("Email",           r.email)}
        ${opt("Mailing list",    r.mailingList)}
        ${full("Accessibility",  r.accessibility)}
      </div>
    </div>`).join("");
}

filterEvent.addEventListener("input",   renderEventResponses);
filterRating.addEventListener("change", renderEventResponses);

// ── Café stats & responses ────────────────────────────────
function renderCafeStats() {
  const total     = allCafeResponses.length;
  const avg       = total ? (allCafeResponses.reduce((s,r) => s+(r.overallRating||0),0)/total).toFixed(1) : null;
  const recommend = allCafeResponses.filter(r => r.recommend==="Definitely"||r.recommend==="Probably").length;
  const alcohol   = allCafeResponses.filter(r => r.alcohol==="Yes").length;
  document.getElementById("statTotal").textContent  = total;
  document.getElementById("statAvg").textContent    = avg ? avg+" \u2605" : "\u2014";
  document.getElementById("statEvents").textContent = total ? Math.round((recommend/total)*100)+"%" : "\u2014";
  document.getElementById("statEmails").textContent = alcohol;
  document.getElementById("statLabel3").textContent = "Would recommend";
  document.getElementById("statLabel4").textContent = "Ordered alcohol";
}

function renderCafeResponses() {
  const dtFilter  = document.getElementById("filterCafeDate").value;
  const todFilter = document.getElementById("filterTimeOfDay").value;
  const list      = document.getElementById("responseList");
  const filtered  = allCafeResponses.filter(r =>
    (!dtFilter  || r.visitDate===dtFilter) &&
    (!todFilter || r.timeOfDay===todFilter)
  );
  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">No café responses match this filter.</div>';
    return;
  }
  list.innerHTML = filtered.map(r => `
    <div class="response-card">
      <div class="rc-meta">
        <span>&#x2615; Café</span>
        <span>&#x1F4C5; ${r.visitDate||"—"}</span>
        <span class="rc-tag">${r.timeOfDay||"—"}</span>
        <span class="rc-stars">${renderStars(r.overallRating)}</span>
        <span class="rc-date">${formatDate(r.submittedAt)}</span>
      </div>
      ${r.comments ? `<div class="rc-label">Comments</div><div class="rc-value">${r.comments}</div>` : ""}
      <div class="rc-grid" style="margin-top:${r.comments?"8px":"0"}">
        ${opt("Had",             r.had)}
        ${opt("Alcoholic drink", r.alcohol)}
        ${opt("Food choice",     r.foodChoice)}
        ${opt("Wait time",       r.waitTime)}
        ${opt("Food rating",     r.foodRating    ? renderStars(r.foodRating)    : "")}
        ${opt("Service rating",  r.serviceRating ? renderStars(r.serviceRating) : "")}
        ${opt("Would recommend", r.recommend)}
      </div>
    </div>`).join("");
}

document.getElementById("filterCafeDate").addEventListener("input",    renderCafeResponses);
document.getElementById("filterTimeOfDay").addEventListener("change",  renderCafeResponses);

// ── CSV export ────────────────────────────────────────────
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
  downloadCSV(rows, headers, "maltings-events");
}

function exportCafeCSV() {
  if (!allCafeResponses.length) { alert("No café responses to export."); return; }
  const headers = ["ID","Submitted","Visit date","Time of day","Overall rating","Food rating",
                   "Service rating","Had","Alcoholic drink","Food choice","Wait time","Comments","Would recommend"];
  const rows = allCafeResponses.map(r => [
    r.id, isoDate(r.submittedAt), r.visitDate, r.timeOfDay, r.overallRating,
    r.foodRating, r.serviceRating, r.had, r.alcohol,
    r.foodChoice, r.waitTime, r.comments, r.recommend
  ]);
  downloadCSV(rows, headers, "maltings-cafe");
}

function downloadCSV(rows, headers, filename) {
  const csv  = [headers,...rows].map(row =>
    row.map(v => `"${String(v??"").replace(/"/g,'""')}"`).join(",")
  ).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${filename}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Helpers ───────────────────────────────────────────────
function renderStars(n) {
  return "\u2605".repeat(n||0)+"\u2606".repeat(5-(n||0));
}
function formatDate(ts) {
  return ts?.toDate ? ts.toDate().toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "—";
}
function formatDateStr(str) {
  if (!str) return "";
  const d = new Date(str);
  return d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
}
function isoDate(ts) { return ts?.toDate ? ts.toDate().toISOString() : ""; }
function opt(label, val) {
  return val ? `<div><div class="rc-label">${label}</div><div class="rc-value">${val}</div></div>` : "";
}
function full(label, val) {
  return val ? `<div style="grid-column:1/-1"><div class="rc-label">${label}</div><div class="rc-value">${val}</div></div>` : "";
}
function friendlyAuthError(code) {
  switch(code) {
    case "auth/invalid-email":      return "Please enter a valid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "Email or password is incorrect.";
    case "auth/too-many-requests":  return "Too many attempts. Please wait a moment and try again.";
    default:                        return "Sign-in failed. Please try again.";
  }
}
