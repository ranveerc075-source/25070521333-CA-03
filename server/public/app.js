const grid = document.getElementById("slotGrid");
const dialog = document.getElementById("bookingDialog");
const form = document.getElementById("bookingForm");
const authDialog = document.getElementById("authDialog");
const authForm = document.getElementById("authForm");
const openAuthBtn = document.getElementById("openAuthBtn");
const closeAuthDialog = document.getElementById("closeAuthDialog");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const authDialogTitle = document.getElementById("authDialogTitle");
const authDialogSubtitle = document.getElementById("authDialogSubtitle");
const loginQuickRow = document.getElementById("loginQuickRow");
const registerNameGroup = document.getElementById("registerNameGroup");
const registerExtraGroup = document.getElementById("registerExtraGroup");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authMessage = document.getElementById("authMessage");
const authNavContainer = document.getElementById("authNavContainer");
const heroRegisterBtn = document.getElementById("heroRegisterBtn");
const bookingUserHint = document.getElementById("bookingUserHint");
const userWelcomeText = document.getElementById("userWelcomeText");

let slots = [];
let activeFilter = "All";
let authMode = "login"; // 'login' or 'register'
let currentUser = null;

try {
  const saved = localStorage.getItem("flexi_user");
  if (saved) currentUser = JSON.parse(saved);
} catch (e) {}

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

function updateNavAuth() {
  if (currentUser) {
    authNavContainer.innerHTML = `
      <div class="user-profile-badge">
        <span class="user-avatar-tag">${currentUser.name.charAt(0).toUpperCase()}</span>
        <span class="user-name-tag">${escapeHtml(currentUser.name)}</span>
        <button class="user-logout-btn" id="logoutBtn" title="Sign Out">Sign Out</button>
      </div>
    `;
    document.getElementById("logoutBtn").addEventListener("click", logout);
    if (userWelcomeText) {
      userWelcomeText.textContent = `Logged in as ${currentUser.name} (${currentUser.email}). Click any available spot to book.`;
    }
    if (heroRegisterBtn) heroRegisterBtn.style.display = "none";
  } else {
    authNavContainer.innerHTML = `<button id="openAuthBtn" class="nav-auth-btn">Login / Sign Up</button>`;
    document.getElementById("openAuthBtn").addEventListener("click", () => openAuth("login"));
    if (userWelcomeText) {
      userWelcomeText.textContent = "Select an available slot to book. Sign in for one-click reservation!";
    }
    if (heroRegisterBtn) heroRegisterBtn.style.display = "inline-flex";
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem("flexi_user");
  updateNavAuth();
  toast("Logged out successfully.");
}

function setAuthMode(mode) {
  authMode = mode;
  authMessage.textContent = "";
  if (mode === "login") {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    authDialogTitle.textContent = "Welcome Back";
    authDialogSubtitle.textContent = "Sign in to access your parking reservations.";
    loginQuickRow.style.display = "flex";
    registerNameGroup.style.display = "none";
    registerExtraGroup.style.display = "none";
    document.getElementById("authName").required = false;
    authSubmitBtn.innerHTML = "Sign In <span>→</span>";
  } else {
    tabLogin.classList.remove("active");
    tabRegister.classList.add("active");
    authDialogTitle.textContent = "Create Account";
    authDialogSubtitle.textContent = "Register a new profile to be stored in MongoDB Compass.";
    loginQuickRow.style.display = "none";
    registerNameGroup.style.display = "block";
    registerExtraGroup.style.display = "block";
    document.getElementById("authName").required = true;
    authSubmitBtn.innerHTML = "Create Account & Save to MongoDB <span>→</span>";
  }
}

function openAuth(mode = "login") {
  setAuthMode(mode);
  authDialog.showModal();
}

tabLogin.addEventListener("click", () => setAuthMode("login"));
tabRegister.addEventListener("click", () => setAuthMode("register"));
closeAuthDialog.addEventListener("click", () => authDialog.close());

if (heroRegisterBtn) {
  heroRegisterBtn.addEventListener("click", () => openAuth("register"));
}

document.getElementById("demoAdminBtn").addEventListener("click", () => {
  document.getElementById("authEmail").value = "admin@flexipark.com";
  document.getElementById("authPassword").value = "admin123";
  authMessage.textContent = "";
});

document.getElementById("demoUserBtn").addEventListener("click", () => {
  document.getElementById("authEmail").value = "alex@flexipark.com";
  document.getElementById("authPassword").value = "user123";
  authMessage.textContent = "";
});

authForm.addEventListener("submit", async e => {
  e.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  authSubmitBtn.disabled = true;

  try {
    if (authMode === "login") {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      currentUser = res.user;
      localStorage.setItem("flexi_user", JSON.stringify(res.user));
      authDialog.close();
      updateNavAuth();
      toast(`Welcome back, ${currentUser.name}!`);
    } else {
      const name = document.getElementById("authName").value.trim();
      const vehicleNumber = document.getElementById("authVehicle").value.trim();
      const phone = document.getElementById("authPhone").value.trim();
      const res = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, vehicleNumber, phone })
      });
      currentUser = res.user;
      localStorage.setItem("flexi_user", JSON.stringify(res.user));
      authDialog.close();
      updateNavAuth();
      toast("Account registered and saved to MongoDB Compass (users collection)!");
    }
  } catch (err) {
    authMessage.textContent = err.message;
  } finally {
    authSubmitBtn.disabled = false;
  }
});

function updateStats() {
  const available = slots.filter(s => s.status === "Available").length;
  const occupied = slots.length - available;
  document.getElementById("availableCount").textContent = available;
  document.getElementById("occupiedCount").textContent = occupied;
  document.getElementById("totalCount").textContent = slots.length;
  document.getElementById("utilization").textContent = slots.length ? Math.round((occupied / slots.length) * 100) + "%" : "0%";
}

function renderSlots() {
  const shown = slots.filter(s => activeFilter === "All" || s.status === activeFilter);
  if (!shown.length) {
    grid.innerHTML = '<div class="empty">No spaces in this category right now.</div>';
    return;
  }
  grid.innerHTML = shown.map(s => {
    const occupied = s.status === "Occupied";
    const vehicleIcon = s.vehicleType === "Bike" ? "🏍️" : s.vehicleType === "EV" ? "🔋" : "🚘";
    return `<article class="slot-card">
      <div class="slot-top">
        <span class="slot-number">${escapeHtml(s.slotNumber)}</span>
        <span class="status-pill ${occupied ? "occupied" : "available"}">${s.status}</span>
      </div>
      <div class="slot-visual"><span class="slot-car">${vehicleIcon}</span></div>
      <div class="slot-details"><span>Vehicle type</span><b>${escapeHtml(s.vehicleType)}</b></div>
      ${occupied ? `<div class="slot-owner">${escapeHtml(s.vehicleNumber)} · ${escapeHtml(s.ownerName)}</div>` : `<div class="slot-owner">Ready for your vehicle</div>`}
      <div class="slot-actions">${occupied
        ? `<button class="slot-btn release" data-release="${s._id}">Release slot</button>`
        : `<button class="slot-btn" data-book="${s._id}">Book this slot <span>→</span></button>`}</div>
    </article>`;
  }).join("");

  grid.querySelectorAll("[data-book]").forEach(btn => btn.addEventListener("click", () => openBooking(btn.dataset.book)));
  grid.querySelectorAll("[data-release]").forEach(btn => btn.addEventListener("click", () => releaseSlot(btn.dataset.release)));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

async function loadSlots() {
  try {
    slots = await api("/api/slots");
    document.getElementById("dbStatus").textContent = "MongoDB connected";
    updateStats();
    renderSlots();
  } catch (e) {
    document.getElementById("dbStatus").textContent = "Database unavailable";
    grid.innerHTML = `<div class="empty">Could not load parking spaces. Make sure MongoDB Server is running, then restart the app.<br><br>${escapeHtml(e.message)}</div>`;
  }
}

function openBooking(id) {
  const slot = slots.find(s => s._id === id);
  if (!slot) return;
  document.getElementById("slotId").value = id;
  document.getElementById("dialogTitle").textContent = `Book ${slot.slotNumber}`;
  document.getElementById("formMessage").textContent = "";
  form.reset();
  document.getElementById("slotId").value = id;

  if (currentUser) {
    document.getElementById("ownerName").value = currentUser.name || "";
    document.getElementById("vehicleNumber").value = currentUser.vehicleNumber || "";
    bookingUserHint.style.display = "block";
    bookingUserHint.textContent = `✓ Autofilled from your profile (${currentUser.email})`;
  } else {
    bookingUserHint.style.display = "none";
  }

  dialog.showModal();
}

async function releaseSlot(id) {
  if (!confirm("Release this parking slot?")) return;
  try {
    await api(`/api/slots/${id}/release`, { method: "POST", body: JSON.stringify({}) });
    await loadSlots();
    toast("Parking slot released.");
  } catch (e) {
    toast(e.message);
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const id = document.getElementById("slotId").value;
  const ownerName = document.getElementById("ownerName").value.trim();
  const vehicleNumber = document.getElementById("vehicleNumber").value.trim();
  const submit = form.querySelector(".submit-btn");
  submit.disabled = true;
  submit.textContent = "Saving booking…";
  try {
    await api(`/api/slots/${id}/book`, { method: "POST", body: JSON.stringify({ ownerName, vehicleNumber }) });
    dialog.close();
    await loadSlots();
    toast("Booking saved to MongoDB.");
  } catch (e) {
    document.getElementById("formMessage").textContent = e.message;
  } finally {
    submit.disabled = false;
    submit.innerHTML = "Confirm booking <span>→</span>";
  }
});

document.getElementById("closeDialog").addEventListener("click", () => dialog.close());

document.querySelectorAll(".filter").forEach(button => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b === button));
  renderSlots();
}));

updateNavAuth();
loadSlots();
