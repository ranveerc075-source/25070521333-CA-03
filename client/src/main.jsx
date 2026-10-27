import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const request = async (url, options = {}) => {
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || "Request failed.");
  return d;
};

function App() {
  // Navigation / View State ('dashboard' or 'auth')
  const [currentView, setCurrentView] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    if (path.includes("login") || path.includes("register") || hash.includes("login") || hash.includes("register")) {
      return "auth";
    }
    return "dashboard";
  });

  const [slots, setSlots] = useState([]);
  const [filter, setFilter] = useState("All");
  const [dbStatus, setDbStatus] = useState("Checking database…");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [ownerName, setOwnerName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const [toast, setToast] = useState("");
  const [bookingBusy, setBookingBusy] = useState(false);

  // Auth State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("flexi_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authTab, setAuthTab] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    return (path.includes("register") || hash.includes("register")) ? "register" : "login";
  });

  // Modal Auth State (if opened from dashboard)
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Form Inputs
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authVehicle, setAuthVehicle] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  async function loadSlots() {
    try {
      const data = await request("/api/slots");
      setSlots(data);
      setDbStatus("MongoDB connected");
    } catch (e) {
      setDbStatus("Database offline");
      setBookingMessage(e.message);
    }
  }

  useEffect(() => {
    loadSlots();

    // Listen to browser popstate (back/forward)
    const handlePopState = () => {
      const p = window.location.pathname.toLowerCase();
      const h = window.location.hash.toLowerCase();
      if (p.includes("login") || p.includes("register") || h.includes("login") || h.includes("register")) {
        setCurrentView("auth");
        setAuthTab(p.includes("register") || h.includes("register") ? "register" : "login");
      } else {
        setCurrentView("dashboard");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const available = useMemo(() => slots.filter(s => s.status === "Available").length, [slots]);
  const occupied = slots.length - available;
  const visible = slots.filter(s => filter === "All" || s.status === filter);

  function notify(text) {
    setToast(text);
    window.setTimeout(() => setToast(""), 3200);
  }

  function navigateTo(view, tab = "login") {
    setCurrentView(view);
    setAuthTab(tab);
    setAuthError("");
    setAuthSuccess("");
    if (view === "auth") {
      window.history.pushState(null, "", tab === "register" ? "/register" : "/login");
    } else {
      window.history.pushState(null, "", "/");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openBookingModal(slot) {
    setSelectedSlot(slot);
    setOwnerName(currentUser ? currentUser.name : "");
    setVehicleNumber(currentUser?.vehicleNumber || "");
    setBookingMessage("");
  }

  async function handleBook(e) {
    e.preventDefault();
    if (!selectedSlot) return;
    setBookingBusy(true);
    setBookingMessage("");
    try {
      await request(`/api/slots/${selectedSlot._id}/book`, {
        method: "POST",
        body: JSON.stringify({ ownerName, vehicleNumber })
      });
      setSelectedSlot(null);
      await loadSlots();
      notify(`Slot ${selectedSlot.slotNumber} booked & saved to MongoDB.`);
    } catch (err) {
      setBookingMessage(err.message);
    } finally {
      setBookingBusy(false);
    }
  }

  async function handleRelease(slot) {
    if (!window.confirm(`Release slot ${slot.slotNumber}?`)) return;
    try {
      await request(`/api/slots/${slot._id}/release`, {
        method: "POST",
        body: JSON.stringify({})
      });
      await loadSlots();
      notify(`Slot ${slot.slotNumber} released.`);
    } catch (e) {
      notify(e.message);
    }
  }

  function handleLogout() {
    setCurrentUser(null);
    localStorage.removeItem("flexi_user");
    notify("You have signed out successfully.");
  }

  function fillDemoCredentials(type) {
    if (type === "admin") {
      setAuthEmail("admin@flexipark.com");
      setAuthPassword("admin123");
    } else {
      setAuthEmail("alex@flexipark.com");
      setAuthPassword("user123");
    }
    setAuthError("");
  }

  async function submitLogin(e) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthSuccess("");
    try {
      const res = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword
        })
      });

      setCurrentUser(res.user);
      localStorage.setItem("flexi_user", JSON.stringify(res.user));
      setAuthSuccess(`Welcome back, ${res.user.name}!`);
      notify(`Welcome back, ${res.user.name}!`);
      setAuthModalOpen(false);
      setAuthPassword("");

      // If on auth page, redirect smoothly to dashboard
      setTimeout(() => {
        navigateTo("dashboard");
      }, 700);
    } catch (err) {
      setAuthError(err.message || "Invalid email or password.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function submitRegister(e) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthSuccess("");
    try {
      const res = await request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: authName.trim(),
          email: authEmail.trim(),
          password: authPassword,
          phone: authPhone.trim(),
          vehicleNumber: authVehicle.trim()
        })
      });

      setCurrentUser(res.user);
      localStorage.setItem("flexi_user", JSON.stringify(res.user));
      setAuthSuccess("Account created and saved to MongoDB Compass (users collection)!");
      notify("Account registered and saved to MongoDB!");
      setAuthModalOpen(false);
      setAuthPassword("");

      // Redirect smoothly to dashboard
      setTimeout(() => {
        navigateTo("dashboard");
      }, 700);
    } catch (err) {
      setAuthError(err.message || "Registration failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  // Render Auth Form Component (Used in both dedicated page and modal)
  const renderAuthForm = () => (
    <>
      <div className="auth-tabs">
        <button
          type="button"
          className={`auth-tab ${authTab === "login" ? "active" : ""}`}
          onClick={() => {
            setAuthTab("login");
            setAuthError("");
            setAuthSuccess("");
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          className={`auth-tab ${authTab === "register" ? "active" : ""}`}
          onClick={() => {
            setAuthTab("register");
            setAuthError("");
            setAuthSuccess("");
          }}
        >
          Create Account
        </button>
      </div>

      {authTab === "login" ? (
        <form onSubmit={submitLogin}>
          <div className="quick-fill-row">
            <span>Quick demo fill:</span>
            <button
              type="button"
              className="quick-fill-chip"
              onClick={() => fillDemoCredentials("admin")}
            >
              Admin Account
            </button>
            <button
              type="button"
              className="quick-fill-chip"
              onClick={() => fillDemoCredentials("user")}
            >
              User Account
            </button>
          </div>

          <div className="auth-form-group">
            <label>Email Address</label>
            <input
              type="email"
              required
              autoFocus
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              placeholder="e.g. admin@flexipark.com"
            />
          </div>

          <div className="auth-form-group">
            <label>Password</label>
            <input
              type="password"
              required
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          {authError && <div className="form-message error">{authError}</div>}
          {authSuccess && <div className="form-message success">{authSuccess}</div>}

          <button className="submit-btn" type="submit" disabled={authBusy}>
            {authBusy ? "Verifying with MongoDB…" : "Sign In →"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitRegister}>
          <div className="auth-form-group">
            <label>Full Name</label>
            <input
              type="text"
              required
              autoFocus
              value={authName}
              onChange={e => setAuthName(e.target.value)}
              placeholder="e.g. Rahul Verma"
            />
          </div>

          <div className="auth-form-group">
            <label>Email Address</label>
            <input
              type="email"
              required
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              placeholder="rahul@example.com"
            />
          </div>

          <div className="auth-form-group">
            <label>Password (min 6 characters)</label>
            <input
              type="password"
              required
              minLength={6}
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              placeholder="Create a strong password"
            />
          </div>

          <div className="auth-form-group">
            <label>Vehicle Number (Optional)</label>
            <input
              type="text"
              value={authVehicle}
              onChange={e => setAuthVehicle(e.target.value)}
              placeholder="e.g. MH 12 AB 9999"
            />
          </div>

          <div className="auth-form-group">
            <label>Phone Number (Optional)</label>
            <input
              type="tel"
              value={authPhone}
              onChange={e => setAuthPhone(e.target.value)}
              placeholder="e.g. +91 98765 00000"
            />
          </div>

          {authError && <div className="form-message error">{authError}</div>}
          {authSuccess && <div className="form-message success">{authSuccess}</div>}

          <button className="submit-btn" type="submit" disabled={authBusy}>
            {authBusy ? "Creating User in MongoDB…" : "Register & Sync to MongoDB →"}
          </button>
        </form>
      )}

      <div className="compass-info-box">
        <span className="compass-badge-icon">🍃</span>
        <div>
          <b>MongoDB Compass Live Sync:</b>
          <div>
            Credentials are securely hashed and stored in database <code>flexi_parking</code>, collection <code>users</code>.
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Navigation Bar */}
      <nav className="nav">
        <div className="brand" onClick={() => navigateTo("dashboard")}>
          <span className="brand-mark">F</span> FLEXI<span className="brand-light">PARK</span>
        </div>

        <div className="nav-links">
          <button
            className={`nav-link ${currentView === "dashboard" ? "active" : ""}`}
            onClick={() => navigateTo("dashboard")}
          >
            Dashboard
          </button>
          {!currentUser ? (
            <>
              <button
                className={`nav-link ${currentView === "auth" && authTab === "login" ? "active" : ""}`}
                onClick={() => navigateTo("auth", "login")}
              >
                Sign In
              </button>
              <button
                className={`nav-link ${currentView === "auth" && authTab === "register" ? "active" : ""}`}
                onClick={() => navigateTo("auth", "register")}
              >
                Register
              </button>
            </>
          ) : null}
        </div>

        <div className="nav-right">
          <div className="db-pill">
            <span className="live-dot"></span>
            <span>{dbStatus}</span>
          </div>

          {currentUser ? (
            <div className="user-profile-badge">
              <span className="user-avatar-tag">
                {currentUser.name.charAt(0).toUpperCase()}
              </span>
              <span className="user-name-tag">{currentUser.name}</span>
              <button className="user-logout-btn" onClick={handleLogout} title="Sign Out">
                Sign Out
              </button>
            </div>
          ) : (
            <button className="nav-auth-btn" onClick={() => setAuthModalOpen(true)}>
              Login / Sign Up
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      {currentView === "auth" ? (
        /* Dedicated Full-Page Login & Register Screen */
        <div className="auth-page-wrapper">
          <div className="auth-card">
            <div className="auth-card-header">
              <div className="auth-card-badge">🍃 MongoDB Connected</div>
              <h1>{authTab === "login" ? "Sign In to FLEXIPARK" : "Create Your Account"}</h1>
              <p className="sub">
                {authTab === "login"
                  ? "Access your live parking reservations and saved vehicle details."
                  : "Register to save your profile into MongoDB Compass users collection."}
              </p>
            </div>

            {renderAuthForm()}

            <div style={{ textAlign: "center", marginTop: "22px" }}>
              <button
                type="button"
                onClick={() => navigateTo("dashboard")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#546858",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                  textDecoration: "underline"
                }}
              >
                ← Back to Parking Dashboard
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Parking Dashboard View */
        <main className="shell">
          <section className="hero">
            <div className="hero-copy">
              <p className="eyebrow">SMART PARKING & USER MANAGEMENT</p>
              <h1>
                Your spot.<br />
                <span>Without the hassle.</span>
              </h1>
              <p className="subhead">
                Find an open space, reserve it in seconds, and synchronize all bookings and registered users directly to MongoDB Compass.
              </p>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <a href="#parking" className="primary-link">
                  Explore parking <span>↘</span>
                </a>
                {!currentUser ? (
                  <button
                    onClick={() => navigateTo("auth", "register")}
                    className="primary-link"
                    style={{ background: "#395244" }}
                  >
                    Create Account <span>+</span>
                  </button>
                ) : (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "#d6e8cb",
                      color: "#284a1d",
                      padding: "10px 18px",
                      borderRadius: "10px",
                      fontWeight: "700",
                      fontSize: "12px"
                    }}
                  >
                    ✓ Signed in as {currentUser.name}
                  </div>
                )}
              </div>
            </div>
            <div className="hero-art">
              <div className="sun"></div>
              <div className="road">
                <div className="road-line"></div>
              </div>
              <div className="car car-back">
                <div className="window"></div>
                <div className="wheel left"></div>
                <div className="wheel right"></div>
              </div>
              <div className="car car-front">
                <div className="window"></div>
                <div className="wheel left"></div>
                <div className="wheel right"></div>
              </div>
              <div className="parking-sign">
                <b>P</b>
                <small>PARKING</small>
              </div>
            </div>
          </section>

          <section className="stats">
            <article className="stat-card">
              <span className="stat-icon green">↗</span>
              <div>
                <p>Available spaces</p>
                <h2>{available}</h2>
              </div>
            </article>
            <article className="stat-card">
              <span className="stat-icon dark">▣</span>
              <div>
                <p>Occupied spaces</p>
                <h2>{occupied}</h2>
              </div>
            </article>
            <article className="stat-card">
              <span className="stat-icon orange">⌁</span>
              <div>
                <p>Total capacity</p>
                <h2>{slots.length}</h2>
              </div>
            </article>
            <article className="stat-card">
              <span className="stat-icon purple">◷</span>
              <div>
                <p>Utilization</p>
                <h2>{slots.length ? Math.round((occupied / slots.length) * 100) : 0}%</h2>
              </div>
            </article>
          </section>

          <section id="parking" className="parking-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">LIVE OVERVIEW</p>
                <h2>Parking spaces</h2>
                <p className="muted">
                  {currentUser
                    ? `Logged in as ${currentUser.name} (${currentUser.email}). Selecting a slot will auto-fill your details.`
                    : "Select an available slot to book. Sign in for quick one-click reservations!"}
                </p>
              </div>
              <div className="filters">
                {["All", "Available", "Occupied"].map(f => (
                  <button
                    key={f}
                    className={`filter ${filter === f ? "active" : ""}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === "All" ? "All spaces" : f}
                  </button>
                ))}
              </div>
            </div>

            <div className="legend">
              <span>
                <i className="legend-dot free"></i> Available
              </span>
              <span>
                <i className="legend-dot busy"></i> Occupied
              </span>
              <span className="refresh-label">● Live data synced with MongoDB Compass</span>
            </div>

            <div className="slot-grid">
              {visible.length ? (
                visible.map(s => {
                  const isBusy = s.status === "Occupied";
                  const icon =
                    s.vehicleType === "Bike" ? "🏍️" : s.vehicleType === "EV" ? "🔋" : "🚘";
                  return (
                    <article className="slot-card" key={s._id}>
                      <div className="slot-top">
                        <span className="slot-number">{s.slotNumber}</span>
                        <span className={`status-pill ${isBusy ? "occupied" : "available"}`}>
                          {s.status}
                        </span>
                      </div>
                      <div className="slot-visual">
                        <span className="slot-car">{icon}</span>
                      </div>
                      <div className="slot-details">
                        <span>Vehicle type</span>
                        <b>{s.vehicleType}</b>
                      </div>
                      {isBusy ? (
                        <div className="slot-owner">
                          {s.vehicleNumber} · {s.ownerName}
                        </div>
                      ) : (
                        <div className="slot-owner">Ready for reservation</div>
                      )}
                      <div className="slot-actions">
                        {isBusy ? (
                          <button className="slot-btn release" onClick={() => handleRelease(s)}>
                            Release slot
                          </button>
                        ) : (
                          <button className="slot-btn" onClick={() => openBookingModal(s)}>
                            Book this slot <span>→</span>
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="empty">{bookingMessage || "No spaces in this category right now."}</div>
              )}
            </div>
          </section>

          {/* MongoDB Compass Connection Details Card */}
          <section className="compass-card-section">
            <div className="compass-card-header">
              <span style={{ fontSize: "28px" }}>🍃</span>
              <div>
                <h3>MongoDB Compass Connection Guide</h3>
                <p className="muted" style={{ margin: "3px 0 0" }}>
                  Connect your MongoDB Compass desktop client to inspect live records.
                </p>
              </div>
            </div>
            <div className="compass-grid-info">
              <div className="compass-info-item">
                <span>Compass Connection String</span>
                <code>mongodb://127.0.0.1:27017</code>
              </div>
              <div className="compass-info-item">
                <span>Database Name</span>
                <code>flexi_parking</code>
              </div>
              <div className="compass-info-item">
                <span>Collections</span>
                <code>users · slots</code>
              </div>
            </div>
          </section>

          <section className="bottom-note">
            <div className="note-icon">✦</div>
            <div>
              <b>Full-Stack Parking & Authentication.</b>
              <p>Every account registration, sign-in, and slot reservation writes directly to MongoDB.</p>
            </div>
            <span className="note-tag">FLEXI CA3</span>
          </section>

          <footer>
            © 2026 FLEXIPARK <span>Full-Stack MERN / Express + MongoDB Compass</span>
          </footer>
        </main>
      )}

      {/* Booking Modal (with full backdrop styling) */}
      {selectedSlot && (
        <div
          className="modal-backdrop"
          onClick={e => {
            if (e.target === e.currentTarget) setSelectedSlot(null);
          }}
        >
          <div className="modal">
            <button
              type="button"
              className="close"
              onClick={() => setSelectedSlot(null)}
              aria-label="Close"
            >
              ×
            </button>
            <p className="eyebrow">RESERVE YOUR SPACE</p>
            <h2>Book {selectedSlot.slotNumber}</h2>
            <p className="muted">Enter details for this {selectedSlot.vehicleType} parking space.</p>

            {currentUser ? (
              <div
                style={{
                  background: "#edf8e5",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  color: "#356621",
                  marginBottom: "12px",
                  fontWeight: "600"
                }}
              >
                ✓ Autofilled from your profile ({currentUser.email})
              </div>
            ) : (
              <div
                style={{
                  background: "#f3f5f1",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  color: "#576b5c",
                  marginBottom: "12px"
                }}
              >
                Tip: You can{" "}
                <span
                  style={{ textDecoration: "underline", cursor: "pointer", fontWeight: "700" }}
                  onClick={() => {
                    setSelectedSlot(null);
                    setAuthModalOpen(true);
                  }}
                >
                  Sign In
                </span>{" "}
                to auto-fill your details.
              </div>
            )}

            <form onSubmit={handleBook}>
              <div className="auth-form-group">
                <label>Your Name</label>
                <input
                  required
                  maxLength="70"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  placeholder="e.g. Alex Sharma"
                />
              </div>

              <div className="auth-form-group">
                <label>Vehicle Registration Number</label>
                <input
                  required
                  maxLength="20"
                  value={vehicleNumber}
                  onChange={e => setVehicleNumber(e.target.value)}
                  placeholder="e.g. MH 31 AB 1234"
                />
              </div>

              {bookingMessage && <div className="form-message error">{bookingMessage}</div>}

              <button className="submit-btn" type="submit" disabled={bookingBusy}>
                {bookingBusy ? "Saving reservation…" : "Confirm Booking →"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Login & Register Modal Popup (if user clicks navbar button) */}
      {authModalOpen && (
        <div
          className="modal-backdrop"
          onClick={e => {
            if (e.target === e.currentTarget) setAuthModalOpen(false);
          }}
        >
          <div className="modal">
            <button
              type="button"
              className="close"
              onClick={() => setAuthModalOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <p className="eyebrow">AUTHENTICATION</p>
            <h2>{authTab === "login" ? "Sign In" : "Create Account"}</h2>
            <p className="muted">
              {authTab === "login"
                ? "Sign in with your registered MongoDB credentials."
                : "Create a new user profile stored in MongoDB Compass."}
            </p>

            {renderAuthForm()}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
