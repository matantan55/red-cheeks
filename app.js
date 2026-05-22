/* ═══════════════════════════════════════════
   Red Cheeks — App Logic
   ═══════════════════════════════════════════ */

(() => {
  "use strict";

  // ── State ────────────────────────────────
  const ACCOUNT_KEY    = "redcheeks_account"; 
  const SESSION_KEY    = "redcheeks_session";

  let currentUser = "A";                // "A" or "B"
  let viewDate    = new Date();          // tracks displayed month
  let bookings    = {};                  // { "YYYY-MM-DD": "A"|"B" }
  let account     = loadAccount();       // { email, username, etc }
  let names       = { A: "Driver 1", B: "Driver 2" };

  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS   = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  // ── DOM refs ─────────────────────────────
  const $grid       = document.getElementById("calendar-grid");
  const $weekdays   = document.getElementById("calendar-weekdays");
  const $title      = document.getElementById("month-title");
  const $btnPrev    = document.getElementById("btn-prev");
  const $btnNext    = document.getElementById("btn-next");
  const $btnToday   = document.getElementById("btn-today");
  const $btnA       = document.getElementById("btn-user-a");
  const $btnB       = document.getElementById("btn-user-b");
  const $nameA      = document.getElementById("name-a");
  const $nameB      = document.getElementById("name-b");
  const $legendA    = document.getElementById("legend-a");
  const $legendB    = document.getElementById("legend-b");
  const $inputA     = document.getElementById("input-name-a");
  const $inputB     = document.getElementById("input-name-b");
  const $btnSave    = document.getElementById("btn-save-names");
  const $btnClear   = document.getElementById("btn-clear-all");
  const $toast      = document.getElementById("toast");
  const $statsRows  = document.getElementById("stats-rows");
  const $statsBody  = document.getElementById("stats-body");
  const $btnStatsToggle = document.getElementById("btn-stats-toggle");

  // Auth DOM (Updated)
  const $authScreen     = document.getElementById("auth-screen");
  const $signupForm     = document.getElementById("signup-form");
  const $loginForm      = document.getElementById("login-form");
  const $resetForm      = document.getElementById("reset-form");
  const $appContent      = document.getElementById("app");
  const $authError      = document.getElementById("auth-error");
  
  const $signupEmail    = document.getElementById("signup-email");
  const $signupUser     = document.getElementById("signup-username");
  const $signupPass     = document.getElementById("signup-password");
  const $signupPhone    = document.getElementById("signup-phone");
  const $signupPartner  = document.getElementById("signup-partner");
  const $signupPartnerPhone = document.getElementById("signup-partner-phone");
  const $btnSignup      = document.getElementById("btn-signup-submit");
  
  const $loginEmail     = document.getElementById("login-email");
  const $loginPass      = document.getElementById("login-password");
  const $btnLogin       = document.getElementById("btn-login-submit");
  
  const $resetEmail     = document.getElementById("reset-email");
  const $btnReset       = document.getElementById("btn-reset-submit");
  
  const $linkToLogin    = document.getElementById("link-to-login");
  const $linkToSignup   = document.getElementById("link-to-signup");
  const $linkForgot     = document.getElementById("link-forgot-password");
  const $linkBackLogin  = document.getElementById("link-back-to-login");
  const $btnLogout      = document.getElementById("btn-logout");
  const $btnHeaderLogout = document.getElementById("btn-header-logout");

  // ── Persistence helpers (MONGODB) ──────────
  async function syncBookingsFromServer() {
    if (!account?.email) return;
    try {
      const res = await fetch(`/api/bookings?email=${encodeURIComponent(account.email)}`);
      const data = await res.json();
      if (data.bookings) {
        bookings = data.bookings;
        renderCalendar();
      }
    } catch (e) { console.error("Sync failed", e); }
  }

  async function saveBookings() {
    if (!account?.email) return;
    try {
      await fetch('/api/bookings?email=' + encodeURIComponent(account.email), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookings })
      });
    } catch (e) { console.error("Save failed", e); }
  }

  function loadAccount() {
    try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY)) || null; }
    catch { return null; }
  }
  function saveAccount(acc) {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc));
  }

  // ── Notification Helpers ─────────────────
  function requestNotificationPermission() {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }

  function sendPartnerNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body: body,
        icon: "https://red-cheeks.vercel.app/favicon.ico"
      });
    }
  }

  // ── Toast ────────────────────────────────
  let toastTimer = null;
  function showToast(msg) {
    if (!$toast) return;
    $toast.textContent = msg;
    $toast.classList.remove("hidden");
    $toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      $toast.classList.remove("show");
    }, 2200);
  }

  function showApp() {
    $authScreen.classList.add("hidden");
    $appContent.classList.remove("hidden");
    if (account) {
      names.A = account.username || "Driver 1";
      names.B = account.partner_name || "Driver 2";
    }
    syncNames();
    renderCalendar();
  }

  // ── Auth Logic (MONGODB API) ───────────────
  async function checkAuth() {
    const sessionEmail = localStorage.getItem(SESSION_KEY);
    if (sessionEmail && account) {
      showApp();
      await syncBookingsFromServer();
    } else if (account) {
      toggleAuthForm("login");
    }
    requestNotificationPermission();
  }

  function toggleAuthForm(mode) {
    $signupForm.classList.add("hidden");
    $loginForm.classList.add("hidden");
    $resetForm.classList.add("hidden");
    $authError.classList.add("hidden");

    if (mode === "login") $loginForm.classList.remove("hidden");
    else if (mode === "signup") $signupForm.classList.remove("hidden");
    else if (mode === "reset") $resetForm.classList.remove("hidden");
  }

  async function handleSignUp() {
    const email = $signupEmail.value.trim();
    const username = $signupUser.value.trim();
    const password = $signupPass.value.trim();
    const phone = $signupPhone.value.trim();
    const partner = $signupPartner.value.trim();
    const partnerPhone = $signupPartnerPhone.value.trim();

    if (!email || !username || !password) {
      showAuthError("Please fill in email, username, and password.");
      return;
    }

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password, phone, partner, partnerPhone })
      });
      const data = await res.json();
      
      if (!res.ok) {
        showAuthError(data.message || "Signup failed");
        return;
      }

      showToast("✅ Account created! Please log in.");
      toggleAuthForm("login");
    } catch (e) {
      showAuthError("Connection error.");
    }
  }

  async function handleLogin() {
    const email = $loginEmail.value.trim();
    const password = $loginPass.value.trim();

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        showAuthError(data.message || "Login failed");
        return;
      }

      account = data.user;
      saveAccount(account);
      localStorage.setItem(SESSION_KEY, email);
      showApp();
      await syncBookingsFromServer();
    } catch (e) {
      showAuthError("Connection error.");
    }
  }

  async function handleResetPassword() {
    const email = $resetEmail.value.trim();
    if (!email) {
      showAuthError("Enter your email address.");
      return;
    }

    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      
      showToast(data.message || "📬 Check your email!");
      toggleAuthForm("login");
    } catch (e) {
      showAuthError("Connection error.");
    }
  }

  function showAuthError(msg) {
    $authError.textContent = msg;
    $authError.classList.remove("hidden");
  }

  // ── Helpers ──────────────────────────────
  function dateKey(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function isToday(y, m, d) {
    const t = new Date();
    return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
  }

  function isPast(y, m, d) {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const cell = new Date(y, m, d);
    return cell < t;
  }

  // ── Render Weekday Headers ───────────────
  function renderWeekdays() {
    $weekdays.innerHTML = "";
    WEEKDAYS.forEach(w => {
      const span = document.createElement("span");
      span.textContent = w;
      $weekdays.appendChild(span);
    });
  }

  // ── Render Calendar Grid ─────────────────
  function renderCalendar() {
    const year  = viewDate.getFullYear();
    const month = viewDate.getMonth();

    $title.textContent = `${MONTHS[month]} ${year}`;

    const firstDay   = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    $grid.innerHTML = "";

    // Empty leading cells
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement("div");
      empty.classList.add("day-cell", "empty");
      $grid.appendChild(empty);
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const key  = dateKey(year, month, d);
      const cell = document.createElement("div");
      cell.classList.add("day-cell");
      cell.dataset.date = key;

      if (isToday(year, month, d)) cell.classList.add("today");
      if (isPast(year, month, d))  cell.classList.add("past");

      const owner = bookings[key];
      if (owner) {
        cell.classList.add(`booked-${owner}`);
      }

      // Day number
      const numSpan = document.createElement("span");
      numSpan.classList.add("day-num");
      numSpan.textContent = d;
      cell.appendChild(numSpan);

      // Owner label
      if (owner) {
        const ownerSpan = document.createElement("span");
        ownerSpan.classList.add("day-owner");
        ownerSpan.textContent = names[owner];
        cell.appendChild(ownerSpan);
      }

      // Click handler
      if (!isPast(year, month, d)) {
        cell.addEventListener("click", () => handleDayClick(key, cell));
      }

      $grid.appendChild(cell);
    }
    renderStats();
  }

  // ── Render Statistics ────────────────────
  function renderStats() {
    const monthsData = {};

    // Group bookings by YYYY-MM
    Object.entries(bookings).forEach(([dateStr, user]) => {
      const monthKey = dateStr.substring(0, 7); // "YYYY-MM"
      if (!monthsData[monthKey]) {
        monthsData[monthKey] = { A: 0, B: 0 };
      }
      monthsData[monthKey][user]++;
    });

    const sortedMonths = Object.keys(monthsData).sort().reverse();

    if (sortedMonths.length === 0) {
      $statsRows.innerHTML = '<div class="stats-empty">No bookings yet. Start driving!</div>';
      return;
    }

    $statsRows.innerHTML = "";

    sortedMonths.forEach(monthKey => {
      const [year, month] = monthKey.split("-");
      const monthName = MONTHS[parseInt(month) - 1];
      const data = monthsData[monthKey];
      
      const total = data.A + data.B;
      const pctA = (data.A / total) * 100;
      const pctB = (data.B / total) * 100;

      let winnerLabel = "Tie";
      let winnerClass = "winner-tie";
      if (data.A > data.B) {
        winnerLabel = `${names.A} wins!`;
        winnerClass = "winner-A";
      } else if (data.B > data.A) {
        winnerLabel = `${names.B} wins!`;
        winnerClass = "winner-B";
      }

      const row = document.createElement("div");
      row.classList.add("stats-month-row");
      row.innerHTML = `
        <div class="stats-month-header">
          <span class="stats-month-label">${monthName} ${year}</span>
          <span class="stats-winner-badge ${winnerClass}">${winnerLabel}</span>
        </div>
        <div class="stats-bars">
          <div class="stats-bar-row">
            <span class="stats-bar-name">${names.A}</span>
            <div class="stats-bar-track">
              <div class="stats-bar-fill fill-A" style="width: ${pctA}%"></div>
            </div>
            <span class="stats-bar-count">${data.A}</span>
          </div>
          <div class="stats-bar-row">
            <span class="stats-bar-name">${names.B}</span>
            <div class="stats-bar-track">
              <div class="stats-bar-fill fill-B" style="width: ${pctB}%"></div>
            </div>
            <span class="stats-bar-count">${data.B}</span>
          </div>
        </div>
      `;
      $statsRows.appendChild(row);
    });
  }

  // ── Day Click Logic ──────────────────────
  function handleDayClick(key, cell) {
    const current = bookings[key];

    if (!current) {
      bookings[key] = currentUser;
      saveBookings();
      const msg = `🚗 ${names[currentUser]} booked ${formatDateNice(key)}`;
      showToast(msg);
      sendPartnerNotification("Red Cheeks Booking", msg);
    } else if (current === currentUser) {
      delete bookings[key];
      saveBookings();
      const msg = `❌ Booking removed for ${formatDateNice(key)}`;
      showToast(msg);
      sendPartnerNotification("Red Cheeks Update", msg);
    } else {
      showToast(`🔒 That day is booked by ${names[current]}`);
      cell.classList.add("pulse");
      setTimeout(() => cell.classList.remove("pulse"), 400);
      return;
    }

    renderCalendar();
    const newCell = $grid.querySelector(`[data-date="${key}"]`);
    if (newCell) {
      newCell.classList.add("pulse");
      setTimeout(() => newCell.classList.remove("pulse"), 400);
    }
  }

  function formatDateNice(key) {
    const [y, m, d] = key.split("-").map(Number);
    return `${MONTHS[m - 1]} ${d}`;
  }

  // ── User Switcher ────────────────────────
  function setActiveUser(user) {
    currentUser = user;
    $btnA.classList.toggle("active", user === "A");
    $btnB.classList.toggle("active", user === "B");
  }

  // ── Sync Names to UI ────────────────────
  function syncNames() {
    $nameA.textContent  = names.A;
    $nameB.textContent  = names.B;
    $legendA.textContent = names.A;
    $legendB.textContent = names.B;
    $inputA.value = names.A;
    $inputB.value = names.B;

    document.querySelector(".avatar-a").textContent = names.A.charAt(0).toUpperCase();
    document.querySelector(".avatar-b").textContent = names.B.charAt(0).toUpperCase();
  }

  // ── Event Bindings ───────────────────────
  $btnPrev.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    renderCalendar();
  });

  $btnNext.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    renderCalendar();
  });

  $btnToday.addEventListener("click", () => {
    viewDate = new Date();
    renderCalendar();
  });

  $btnA.addEventListener("click", () => setActiveUser("A"));
  $btnB.addEventListener("click", () => setActiveUser("B"));

  $btnSave.addEventListener("click", async () => {
    const a = $inputA.value.trim() || "Me";
    const b = $inputB.value.trim() || "Bro";
    names.A = a;
    names.B = b;
    
    if (account) {
      account.username = a;
      account.partner_name = b;
      saveAccount(account);
      
      try {
        await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: account.email, 
            username: a, 
            partner_name: b 
          })
        });
      } catch (e) { console.error("Profile sync failed", e); }
    }
    
    syncNames();
    renderCalendar();
    showToast("✅ Names saved & synced!");
  });

  $btnClear.addEventListener("click", () => {
    if (confirm("Clear ALL bookings? This cannot be undone.")) {
      bookings = {};
      saveBookings();
      renderCalendar();
      showToast("🗑️ All bookings cleared");
    }
  });

  // Auth Events
  $btnSignup.addEventListener("click", handleSignUp);
  $btnLogin.addEventListener("click", handleLogin);
  $btnReset.addEventListener("click", handleResetPassword);

  $linkToLogin.addEventListener("click", (e) => { e.preventDefault(); toggleAuthForm("login"); });
  $linkToSignup.addEventListener("click", (e) => { e.preventDefault(); toggleAuthForm("signup"); });
  $linkForgot.addEventListener("click", (e) => { e.preventDefault(); toggleAuthForm("reset"); });
  $linkBackLogin.addEventListener("click", (e) => { e.preventDefault(); toggleAuthForm("login"); });
  
  // ── Logout Handler ───────────────────────
  const logoutHandler = () => {
    // Clear session and account info to ensure proper logout
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
    // Optionally, you could also clear other auth related storage
    location.reload();
  };

  $btnLogout.addEventListener("click", logoutHandler);
  if ($btnHeaderLogout) {
    $btnHeaderLogout.addEventListener("click", logoutHandler);
  }

  $btnStatsToggle.addEventListener("click", () => {
    const isCollapsed = $statsBody.classList.toggle("collapsed");
    $btnStatsToggle.textContent = isCollapsed ? "Show" : "Hide";
    $btnStatsToggle.setAttribute("aria-expanded", !isCollapsed);
  });

  // ── Keyboard shortcuts ───────────────────
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "ArrowLeft")  { $btnPrev.click(); }
    if (e.key === "ArrowRight") { $btnNext.click(); }
    if (e.key === "1") setActiveUser("A");
    if (e.key === "2") setActiveUser("B");
  });

  // ── Boot ─────────────────────────────────
  renderWeekdays();
  checkAuth();
})();
