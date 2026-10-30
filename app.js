/* ═══════════════════════════════════════════
   Red Cheeks — Open Shared Car Calendar
   ═══════════════════════════════════════════ */

(() => {
  "use strict";

  // ── Storage Keys ─────────────────────────
  const STORAGE_NAME_KEY = "redcheeks_driver_name";

  // ── State ────────────────────────────────
  let currentName = localStorage.getItem(STORAGE_NAME_KEY) || "";
  let viewDate    = new Date();
  let bookings    = {}; // { "YYYY-MM-DD": "Name" }
  let activeModalDate = null;
  let syncTimer   = null;

  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS   = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // ── Color Palettes for Drivers ────────────
  const PALETTES = [
    { key: "coral",   accent: "#ff6b6b", bg: "rgba(255, 107, 107, 0.22)", border: "#ff6b6b", text: "#ff8787" },
    { key: "blue",    accent: "#4dabf7", bg: "rgba(77, 171, 247, 0.22)",  border: "#4dabf7", text: "#74c0fc" },
    { key: "emerald", accent: "#38d9a9", bg: "rgba(56, 217, 169, 0.22)",  border: "#38d9a9", text: "#63e6be" },
    { key: "amber",   accent: "#ffd43b", bg: "rgba(255, 212, 59, 0.22)",  border: "#ffd43b", text: "#ffe066" },
    { key: "purple",  accent: "#da77f2", bg: "rgba(218, 119, 242, 0.22)", border: "#da77f2", text: "#e599f7" },
    { key: "cyan",    accent: "#22b8cf", bg: "rgba(34, 184, 207, 0.22)",  border: "#22b8cf", text: "#66d9e8" },
    { key: "orange",  accent: "#ff922b", bg: "rgba(255, 146, 43, 0.22)",  border: "#ff922b", text: "#ffa94d" },
    { key: "indigo",  accent: "#748ffc", bg: "rgba(116, 143, 252, 0.22)", border: "#748ffc", text: "#91a7ff" },
    { key: "lime",    accent: "#94d82d", bg: "rgba(148, 216, 45, 0.22)",  border: "#94d82d", text: "#a9e34b" },
    { key: "pink",    accent: "#f783ac", bg: "rgba(247, 131, 172, 0.22)", border: "#f783ac", text: "#faa2c1" }
  ];

  function getDriverPalette(name) {
    if (!name || !name.trim()) return PALETTES[0];
    const clean = name.trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % PALETTES.length;
    return PALETTES[idx];
  }

  // ── DOM References ───────────────────────
  const $nameInput       = document.getElementById("driver-name-input");
  const $currentAvatar   = document.getElementById("current-avatar");
  const $quickDrivers    = document.getElementById("quick-drivers-list");
  const $quickContainer  = document.getElementById("quick-drivers-container");
  const $syncStatus      = document.getElementById("sync-status");
  const $btnRefresh      = document.getElementById("btn-refresh");

  const $title           = document.getElementById("month-title");
  const $btnPrev         = document.getElementById("btn-prev");
  const $btnNext         = document.getElementById("btn-next");
  const $btnToday        = document.getElementById("btn-today");
  const $weekdays        = document.getElementById("calendar-weekdays");
  const $grid            = document.getElementById("calendar-grid");

  const $legend          = document.getElementById("legend");
  const $statsRows       = document.getElementById("stats-rows");
  const $statsBody       = document.getElementById("stats-body");
  const $btnStatsToggle  = document.getElementById("btn-stats-toggle");

  const $btnClearMy      = document.getElementById("btn-clear-my");
  const $btnClearAll     = document.getElementById("btn-clear-all");
  const $toast           = document.getElementById("toast");

  // Modal DOM
  const $dayModal        = document.getElementById("day-modal");
  const $modalTitle      = document.getElementById("modal-date-title");
  const $modalBadge      = document.getElementById("modal-status-badge");
  const $modalDesc       = document.getElementById("modal-desc");
  const $modalClaimBtn   = document.getElementById("btn-modal-claim");
  const $modalMyName     = document.getElementById("modal-my-name");
  const $modalClearBtn   = document.getElementById("btn-modal-clear-day");
  const $modalCloseBtn   = document.getElementById("btn-modal-close");
  const $modalDismissBtn = document.getElementById("btn-modal-dismiss");

  // ── Helper Formatting ────────────────────
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

  function formatDateNice(key) {
    const [y, m, d] = key.split("-").map(Number);
    return `${MONTHS[m - 1]} ${d}, ${y}`;
  }

  function getInitials(name) {
    if (!name || !name.trim()) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  // ── Toast Notifications ──────────────────
  let toastTimeout = null;
  function showToast(msg) {
    if (!$toast) return;
    $toast.textContent = msg;
    $toast.classList.remove("hidden");
    $toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      $toast.classList.remove("show");
    }, 2500);
  }

  // ── Name & Avatar Sync ───────────────────
  function updateAvatarUI() {
    const name = currentName.trim();
    if (name) {
      const palette = getDriverPalette(name);
      $currentAvatar.textContent = getInitials(name);
      $currentAvatar.style.background = palette.accent;
      $currentAvatar.style.color = "#fff";
      $currentAvatar.style.borderColor = palette.border;
      $currentAvatar.style.boxShadow = `0 0 12px ${palette.bg}`;
      $modalMyName.textContent = name;
    } else {
      $currentAvatar.textContent = "?";
      $currentAvatar.style.background = "var(--surface2)";
      $currentAvatar.style.color = "var(--text-dim)";
      $currentAvatar.style.borderColor = "var(--border)";
      $currentAvatar.style.boxShadow = "none";
      $modalMyName.textContent = "Me";
    }
  }

  function setDriverName(name) {
    currentName = name.trim();
    $nameInput.value = currentName;
    localStorage.setItem(STORAGE_NAME_KEY, currentName);
    updateAvatarUI();
    renderQuickDrivers();
  }

  // ── Render Quick Driver Chips ────────────
  function renderQuickDrivers() {
    // Collect all distinct names currently in bookings + current name
    const activeNames = new Set();
    if (currentName.trim()) activeNames.add(currentName.trim());
    Object.values(bookings).forEach(name => {
      if (name && typeof name === "string" && name.trim()) {
        activeNames.add(name.trim());
      }
    });

    $quickDrivers.innerHTML = "";

    if (activeNames.size === 0) {
      $quickContainer.classList.add("hidden");
      return;
    }

    $quickContainer.classList.remove("hidden");

    activeNames.forEach(name => {
      const palette = getDriverPalette(name);
      const isSelected = (currentName.trim().toLowerCase() === name.toLowerCase());

      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `quick-driver-chip ${isSelected ? "active" : ""}`;
      chip.innerHTML = `
        <span class="chip-dot" style="background: ${palette.accent}"></span>
        <span class="chip-name">${name}</span>
      `;

      if (isSelected) {
        chip.style.borderColor = palette.accent;
        chip.style.background = palette.bg;
      }

      chip.addEventListener("click", () => {
        setDriverName(name);
        showToast(`🚗 Driving as ${name}`);
      });

      $quickDrivers.appendChild(chip);
    });
  }

  // ── API Sync ─────────────────────────────
  async function fetchBookings(isSilent = false) {
    try {
      if (!isSilent) {
        $syncStatus.innerHTML = '<span class="sync-dot pulsing"></span> Syncing...';
      }
      const res = await fetch("/api/bookings");
      if (!res.ok) throw new Error("Server error: " + res.status);
      const data = await res.json();
      bookings = data.bookings || {};

      renderCalendar();
      renderLegend();
      renderStats();
      renderQuickDrivers();

      $syncStatus.innerHTML = '<span class="sync-dot online"></span> Live';
    } catch (err) {
      console.error("Fetch bookings failed:", err);
      $syncStatus.innerHTML = '<span class="sync-dot offline"></span> Offline';
    }
  }

  async function saveDayBooking(date, name) {
    try {
      $syncStatus.innerHTML = '<span class="sync-dot pulsing"></span> Saving...';
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, name })
      });
      if (!res.ok) throw new Error("Save failed");
      $syncStatus.innerHTML = '<span class="sync-dot online"></span> Saved';
    } catch (err) {
      console.error("Save booking failed:", err);
      showToast("⚠️ Could not sync with server. Check connection.");
      $syncStatus.innerHTML = '<span class="sync-dot offline"></span> Error';
    }
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

    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    $grid.innerHTML = "";

    // Empty lead cells
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement("div");
      empty.classList.add("day-cell", "empty");
      $grid.appendChild(empty);
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const key  = dateKey(year, month, d);
      const cell = document.createElement("div");
      cell.classList.add("day-cell");
      cell.dataset.date = key;

      if (isToday(year, month, d)) cell.classList.add("today");
      if (isPast(year, month, d))  cell.classList.add("past");

      const owner = bookings[key];

      // Day number
      const numSpan = document.createElement("span");
      numSpan.classList.add("day-num");
      numSpan.textContent = d;
      cell.appendChild(numSpan);

      // Booked state & dynamic driver styling
      if (owner) {
        cell.classList.add("booked");
        const palette = getDriverPalette(owner);
        cell.style.setProperty("--driver-accent", palette.accent);
        cell.style.setProperty("--driver-bg", palette.bg);
        cell.style.setProperty("--driver-border", palette.border);
        cell.style.setProperty("--driver-text", palette.text);

        const ownerSpan = document.createElement("span");
        ownerSpan.classList.add("day-owner");
        ownerSpan.textContent = owner;
        ownerSpan.title = `Booked by ${owner}`;
        cell.appendChild(ownerSpan);
      }

      // Click handler
      cell.addEventListener("click", () => handleDayClick(key, cell));

      $grid.appendChild(cell);
    }
  }

  // ── Day Click Logic ──────────────────────
  function handleDayClick(key, cell) {
    const [y, m, d] = key.split("-").map(Number);
    const existing = bookings[key];

    // Disallow altering past dates
    if (isPast(y, m - 1, d)) {
      if (existing) {
        showToast(`📅 ${existing} drove on ${formatDateNice(key)}`);
      } else {
        showToast("⚠️ Past dates cannot be booked");
      }
      return;
    }

    const activeDriver = currentName.trim();

    // If day is free
    if (!existing) {
      if (!activeDriver) {
        showToast("⚠️ Enter your name at the top to book!");
        $nameInput.focus();
        $nameInput.classList.add("input-attention");
        setTimeout(() => $nameInput.classList.remove("input-attention"), 1000);
        return;
      }

      // Optimistic update
      bookings[key] = activeDriver;
      renderCalendar();
      renderLegend();
      renderStats();
      renderQuickDrivers();

      showToast(`🚗 ${activeDriver} booked ${formatDateNice(key)}`);
      saveDayBooking(key, activeDriver);
      return;
    }

    // Day is already booked -> Open interactive modal
    openDayModal(key, existing);
  }

  // ── Modal Handling ───────────────────────
  function openDayModal(key, ownerName) {
    activeModalDate = key;
    const palette = getDriverPalette(ownerName);
    const activeDriver = currentName.trim();

    $modalTitle.textContent = formatDateNice(key);
    $modalBadge.textContent = `Booked by ${ownerName}`;
    $modalBadge.style.background = palette.bg;
    $modalBadge.style.color = palette.text;
    $modalBadge.style.borderColor = palette.border;

    if (activeDriver && activeDriver.toLowerCase() === ownerName.toLowerCase()) {
      $modalDesc.textContent = `You currently have this day reserved.`;
      $modalClaimBtn.classList.add("hidden");
      $modalClearBtn.textContent = "Cancel My Booking";
    } else {
      $modalDesc.textContent = `This day is currently taken by ${ownerName}.`;
      $modalClaimBtn.classList.remove("hidden");
      $modalMyName.textContent = activeDriver || "Me";
      $modalClearBtn.textContent = "Free Up This Day";
    }

    $dayModal.classList.remove("hidden");
  }

  function closeDayModal() {
    $dayModal.classList.add("hidden");
    activeModalDate = null;
  }

  // Claim modal date
  $modalClaimBtn.addEventListener("click", () => {
    if (!activeModalDate) return;
    const activeDriver = currentName.trim();
    if (!activeDriver) {
      showToast("⚠️ Enter your name first!");
      closeDayModal();
      $nameInput.focus();
      return;
    }

    bookings[activeModalDate] = activeDriver;
    renderCalendar();
    renderLegend();
    renderStats();
    renderQuickDrivers();

    showToast(`🚗 Reassigned to ${activeDriver}`);
    saveDayBooking(activeModalDate, activeDriver);
    closeDayModal();
  });

  // Free up modal date
  $modalClearBtn.addEventListener("click", () => {
    if (!activeModalDate) return;
    const key = activeModalDate;
    delete bookings[key];

    renderCalendar();
    renderLegend();
    renderStats();
    renderQuickDrivers();

    showToast(`🗑️ Freed up ${formatDateNice(key)}`);
    saveDayBooking(key, null);
    closeDayModal();
  });

  $modalCloseBtn.addEventListener("click", closeDayModal);
  $modalDismissBtn.addEventListener("click", closeDayModal);
  $dayModal.addEventListener("click", (e) => {
    if (e.target === $dayModal) closeDayModal();
  });

  // ── Legend ───────────────────────────────
  function renderLegend() {
    const year  = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

    // Find all distinct drivers with bookings this month
    const driversThisMonth = new Set();
    Object.entries(bookings).forEach(([dateStr, name]) => {
      if (dateStr.startsWith(monthPrefix) && name && name.trim()) {
        driversThisMonth.add(name.trim());
      }
    });

    $legend.innerHTML = "";

    driversThisMonth.forEach(name => {
      const palette = getDriverPalette(name);
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `
        <span class="dot" style="background: ${palette.accent}"></span>
        <span>${name}</span>
      `;
      $legend.appendChild(item);
    });

    // Always include available indicator
    const freeItem = document.createElement("div");
    freeItem.className = "legend-item";
    freeItem.innerHTML = `
      <span class="dot dot-free"></span>
      <span>Available</span>
    `;
    $legend.appendChild(freeItem);
  }

  // ── Render Monthly Stats ─────────────────
  function renderStats() {
    const year  = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

    const counts = {};
    let totalDays = 0;

    Object.entries(bookings).forEach(([dateStr, name]) => {
      if (dateStr.startsWith(monthPrefix) && name && name.trim()) {
        const clean = name.trim();
        counts[clean] = (counts[clean] || 0) + 1;
        totalDays++;
      }
    });

    $statsRows.innerHTML = "";

    const drivers = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    if (drivers.length === 0) {
      $statsRows.innerHTML = `
        <div class="stats-empty">
          No bookings for ${MONTHS[month]} ${year}. Click any date to book!
        </div>
      `;
      return;
    }

    const topDriver = drivers[0];
    const topCount = counts[topDriver];

    const monthHeader = document.createElement("div");
    monthHeader.className = "stats-month-header";
    monthHeader.innerHTML = `
      <span class="stats-month-label">${MONTHS[month]} ${year} (${totalDays} booked)</span>
      <span class="stats-winner-badge">🏆 ${topDriver} leads (${topCount}d)</span>
    `;
    $statsRows.appendChild(monthHeader);

    const barsContainer = document.createElement("div");
    barsContainer.className = "stats-bars";

    drivers.forEach(driver => {
      const count = counts[driver];
      const pct = Math.round((count / totalDays) * 100);
      const palette = getDriverPalette(driver);

      const row = document.createElement("div");
      row.className = "stats-bar-row";
      row.innerHTML = `
        <span class="stats-bar-name" title="${driver}">${driver}</span>
        <div class="stats-bar-track">
          <div class="stats-bar-fill" style="width: ${pct}%; background: ${palette.accent}"></div>
        </div>
        <span class="stats-bar-count">${count}d (${pct}%)</span>
      `;
      barsContainer.appendChild(row);
    });

    $statsRows.appendChild(barsContainer);
  }

  // ── Board Actions ────────────────────────
  $btnClearMy.addEventListener("click", async () => {
    const driver = currentName.trim();
    if (!driver) {
      showToast("⚠️ Enter your name first!");
      $nameInput.focus();
      return;
    }

    if (!confirm(`Clear all bookings on the calendar for "${driver}"?`)) return;

    // Optimistic removal
    Object.keys(bookings).forEach(key => {
      if (bookings[key] && bookings[key].trim().toLowerCase() === driver.toLowerCase()) {
        delete bookings[key];
      }
    });

    renderCalendar();
    renderLegend();
    renderStats();
    renderQuickDrivers();

    try {
      await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clearUser", name: driver })
      });
      showToast(`🗑️ Cleared all bookings for ${driver}`);
    } catch (err) {
      console.error(err);
      showToast("⚠️ Server sync error");
    }
  });

  $btnClearAll.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to clear the ENTIRE calendar board for everyone?")) return;

    bookings = {};
    renderCalendar();
    renderLegend();
    renderStats();
    renderQuickDrivers();

    try {
      await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clearAll" })
      });
      showToast("🗑️ Board cleared");
    } catch (err) {
      console.error(err);
      showToast("⚠️ Server sync error");
    }
  });

  // ── Event Listeners ──────────────────────
  $nameInput.addEventListener("input", (e) => {
    currentName = e.target.value;
    localStorage.setItem(STORAGE_NAME_KEY, currentName);
    updateAvatarUI();
  });

  $nameInput.addEventListener("blur", () => {
    renderQuickDrivers();
  });

  $btnPrev.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    renderCalendar();
    renderLegend();
    renderStats();
  });

  $btnNext.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    renderCalendar();
    renderLegend();
    renderStats();
  });

  $btnToday.addEventListener("click", () => {
    viewDate = new Date();
    renderCalendar();
    renderLegend();
    renderStats();
  });

  $btnRefresh.addEventListener("click", () => {
    fetchBookings(false);
    showToast("🔄 Board refreshed!");
  });

  $btnStatsToggle.addEventListener("click", () => {
    const isCollapsed = $statsBody.classList.toggle("collapsed");
    $btnStatsToggle.textContent = isCollapsed ? "Show" : "Hide";
    $btnStatsToggle.setAttribute("aria-expanded", !isCollapsed);
  });

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "ArrowLeft")  { $btnPrev.click(); }
    if (e.key === "ArrowRight") { $btnNext.click(); }
    if (e.key === "t" || e.key === "T") { $btnToday.click(); }
    if (e.key === "Escape") { closeDayModal(); }
  });

  // ── Auto Sync Polling ────────────────────
  function startPolling() {
    clearInterval(syncTimer);
    // Poll every 15 seconds to keep all devices up-to-date
    syncTimer = setInterval(() => {
      fetchBookings(true);
    }, 15000);
  }

  // ── Boot ─────────────────────────────────
  if (currentName) {
    $nameInput.value = currentName;
  }
  updateAvatarUI();
  renderWeekdays();
  renderCalendar();
  fetchBookings(false);
  startPolling();
})();
