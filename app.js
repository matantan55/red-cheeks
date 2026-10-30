/* ═══════════════════════════════════════════
   Red Cheeks — Shared Car Calendar with Time Slots
   ═══════════════════════════════════════════ */

(() => {
  "use strict";

  // ── Storage Keys ─────────────────────────
  const STORAGE_NAME_KEY  = "redcheeks_driver_name";
  const STORAGE_TOKEN_KEY = "redcheeks_client_token";

  // ── Initialize Client Token ──────────────
  let clientToken = localStorage.getItem(STORAGE_TOKEN_KEY);
  if (!clientToken) {
    clientToken = "tok_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(STORAGE_TOKEN_KEY, clientToken);
  }

  // ── State ────────────────────────────────
  let currentName     = localStorage.getItem(STORAGE_NAME_KEY) || "";
  let viewDate        = new Date();
  let allBookings     = []; // Array of { id, date, startTime, endTime, name, token }
  let activeModalDate = null;
  let syncTimer       = null;

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
  const $btnClearMy      = document.getElementById("btn-clear-my");
  const $toast           = document.getElementById("toast");

  // Modal DOM
  const $dayModal        = document.getElementById("day-modal");
  const $modalTitle      = document.getElementById("modal-date-title");
  const $modalCloseBtn   = document.getElementById("btn-modal-close");
  const $modalSlotsCount = document.getElementById("modal-slots-count");
  const $modalSlotsList  = document.getElementById("modal-existing-slots");
  const $startTimeInput  = document.getElementById("input-start-time");
  const $endTimeInput    = document.getElementById("input-end-time");
  const $conflictMsg     = document.getElementById("modal-conflict-msg");
  const $btnConfirmSlot  = document.getElementById("btn-confirm-slot");
  const $modalDriverPrev = document.getElementById("modal-driver-preview");
  const $presetBtns      = document.querySelectorAll(".preset-btn");

  // ── Helper Functions ─────────────────────
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

  function getBookingsForDate(dateStr) {
    return allBookings
      .filter(b => b.date === dateStr)
      .sort((a, b) => (a.startTime || "00:00").localeCompare(b.startTime || "00:00"));
  }

  // Check if booking belongs to current active user
  function isMyBooking(booking) {
    if (!booking) return false;
    const active = currentName.trim().toLowerCase();
    const bName = (booking.name || "").trim().toLowerCase();
    const tokenMatch = Boolean(booking.token && clientToken && booking.token === clientToken);
    const nameMatch = Boolean(active && bName && active === bName);
    return tokenMatch || nameMatch;
  }

  // Collision detection: [A, B] and [C, D] overlap if A < D and B > C
  function findConflict(dateStr, start, end, excludeId = null) {
    const dayBookings = getBookingsForDate(dateStr);
    return dayBookings.find(b => {
      if (excludeId && b.id === excludeId) return false;
      const bStart = b.startTime || "00:00";
      const bEnd   = b.endTime || "23:59";
      return start < bEnd && end > bStart;
    });
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
    }, 2800);
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
      $modalDriverPrev.textContent = name;
    } else {
      $currentAvatar.textContent = "?";
      $currentAvatar.style.background = "var(--surface2)";
      $currentAvatar.style.color = "var(--text-dim)";
      $currentAvatar.style.borderColor = "var(--border)";
      $currentAvatar.style.boxShadow = "none";
      $modalDriverPrev.textContent = "Driver";
    }
  }

  function setDriverName(name) {
    currentName = name.trim();
    $nameInput.value = currentName;
    localStorage.setItem(STORAGE_NAME_KEY, currentName);
    updateAvatarUI();
    renderQuickDrivers();
    if (activeModalDate) checkLiveConflict();
  }

  // ── Render Quick Driver Chips ────────────
  function renderQuickDrivers() {
    const activeNames = new Set();
    if (currentName.trim()) activeNames.add(currentName.trim());
    allBookings.forEach(b => {
      if (b.name && b.name.trim()) activeNames.add(b.name.trim());
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
        showToast(`🚗 Switched driver to ${name}`);
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
      allBookings = Array.isArray(data.bookings) ? data.bookings : [];

      renderCalendar();
      renderLegend();
      renderQuickDrivers();

      if (activeModalDate) {
        renderModalSlots(activeModalDate);
      }

      $syncStatus.innerHTML = '<span class="sync-dot online"></span> Live';
    } catch (err) {
      console.error("Fetch bookings failed:", err);
      $syncStatus.innerHTML = '<span class="sync-dot offline"></span> Offline';
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

      const daySlots = getBookingsForDate(key);

      // Day number
      const numSpan = document.createElement("span");
      numSpan.classList.add("day-num");
      numSpan.textContent = d;
      cell.appendChild(numSpan);

      // Booked time slots chips
      if (daySlots.length > 0) {
        cell.classList.add("has-bookings");
        const slotsWrapper = document.createElement("div");
        slotsWrapper.classList.add("cell-slots-wrapper");

        // Show up to 2 slots, then +X more
        const maxDisplay = 2;
        daySlots.slice(0, maxDisplay).forEach(slot => {
          const palette = getDriverPalette(slot.name);
          const chip = document.createElement("div");
          chip.className = "cell-slot-chip";
          chip.style.background = palette.bg;
          chip.style.borderColor = palette.border;
          chip.style.color = palette.text;

          const timeBrief = (slot.startTime && slot.endTime)
            ? `${slot.startTime.split(":")[0]}-${slot.endTime.split(":")[0]}`
            : "All Day";

          chip.textContent = `${timeBrief} ${slot.name}`;
          chip.title = `${slot.name}: ${slot.startTime || '00:00'} - ${slot.endTime || '23:59'}`;
          slotsWrapper.appendChild(chip);
        });

        if (daySlots.length > maxDisplay) {
          const moreChip = document.createElement("div");
          moreChip.className = "cell-slot-more";
          moreChip.textContent = `+${daySlots.length - maxDisplay} more`;
          slotsWrapper.appendChild(moreChip);
        }

        cell.appendChild(slotsWrapper);
      }

      // Click handler to open schedule & booking modal
      cell.addEventListener("click", () => handleDayClick(key));

      $grid.appendChild(cell);
    }
  }

  // ── Day Click ────────────────────────────
  function handleDayClick(key) {
    const [y, m, d] = key.split("-").map(Number);

    if (isPast(y, m - 1, d)) {
      const slots = getBookingsForDate(key);
      if (slots.length > 0) {
        openDayModal(key, true); // Open in read-only mode for past dates
      } else {
        showToast("⚠️ Past dates cannot be booked");
      }
      return;
    }

    openDayModal(key, false);
  }

  // ── Modal Handling ───────────────────────
  function openDayModal(key, isReadOnly = false) {
    activeModalDate = key;
    $modalTitle.textContent = formatDateNice(key);

    const formSection = document.querySelector(".book-form-section");
    if (isReadOnly) {
      formSection.classList.add("hidden");
    } else {
      formSection.classList.remove("hidden");
    }

    renderModalSlots(key);

    // Pick sensible default time that doesn't conflict
    suggestDefaultTimes(key);
    checkLiveConflict();

    $dayModal.classList.remove("hidden");
  }

  function closeDayModal() {
    $dayModal.classList.add("hidden");
    activeModalDate = null;
  }

  function renderModalSlots(key) {
    const daySlots = getBookingsForDate(key);
    $modalSlotsCount.textContent = daySlots.length;
    $modalSlotsList.innerHTML = "";

    if (daySlots.length === 0) {
      $modalSlotsList.innerHTML = `
        <div class="empty-day-banner">
          ✨ No reservations yet for this day. The car is free all day!
        </div>
      `;
      return;
    }

    daySlots.forEach(slot => {
      const palette = getDriverPalette(slot.name);
      const isOwner = isMyBooking(slot);

      const row = document.createElement("div");
      row.className = "slot-item-row";
      row.style.borderLeftColor = palette.accent;

      const durationText = calculateDuration(slot.startTime, slot.endTime);

      row.innerHTML = `
        <div class="slot-info">
          <div class="slot-time-range">
            <span class="time-bold">${slot.startTime || "00:00"} – ${slot.endTime || "23:59"}</span>
            <span class="slot-duration">(${durationText})</span>
          </div>
          <div class="slot-driver-badge" style="background: ${palette.bg}; color: ${palette.text}; border-color: ${palette.border}">
            <span class="slot-avatar" style="background: ${palette.accent}">${getInitials(slot.name)}</span>
            <span class="slot-driver-name">${slot.name}</span>
          </div>
        </div>
        <div class="slot-actions">
          ${isOwner 
            ? `<button class="btn-cancel-slot" data-id="${slot.id}" title="Cancel your reservation">Delete</button>` 
            : `<span class="locked-slot-badge" title="Only ${slot.name} can change this">🔒 Reserved</span>`}
        </div>
      `;

      $modalSlotsList.appendChild(row);
    });

    // Attach cancel event listeners
    $modalSlotsList.querySelectorAll(".btn-cancel-slot").forEach(btn => {
      btn.addEventListener("click", () => handleCancelSlot(btn.dataset.id));
    });
  }

  function calculateDuration(start, end) {
    if (!start || !end) return "All Day";
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) return "";
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  function suggestDefaultTimes(dateStr) {
    const slots = getBookingsForDate(dateStr);
    if (slots.length === 0) {
      $startTimeInput.value = "09:00";
      $endTimeInput.value = "13:00";
      return;
    }

    // Try standard candidate intervals
    const candidates = [
      { s: "08:00", e: "12:00" },
      { s: "12:00", e: "17:00" },
      { s: "17:00", e: "22:00" },
      { s: "09:00", e: "13:00" },
      { s: "14:00", e: "18:00" }
    ];

    const freeCandidate = candidates.find(c => !findConflict(dateStr, c.s, c.e));
    if (freeCandidate) {
      $startTimeInput.value = freeCandidate.s;
      $endTimeInput.value = freeCandidate.e;
    }
  }

  // ── Live Conflict Checking ───────────────
  function checkLiveConflict() {
    if (!activeModalDate) return;

    const start = $startTimeInput.value;
    const end   = $endTimeInput.value;

    if (!start || !end || start >= end) {
      $conflictMsg.textContent = "⚠️ End time must be later than start time";
      $conflictMsg.classList.remove("hidden");
      $btnConfirmSlot.disabled = true;
      return;
    }

    const conflict = findConflict(activeModalDate, start, end);
    if (conflict) {
      $conflictMsg.textContent = `⚠️ Overlaps with ${conflict.name}'s reservation (${conflict.startTime} - ${conflict.endTime})`;
      $conflictMsg.classList.remove("hidden");
      $btnConfirmSlot.disabled = true;
    } else {
      $conflictMsg.classList.add("hidden");
      $btnConfirmSlot.disabled = false;
    }
  }

  // ── Confirm New Slot ─────────────────────
  async function handleConfirmSlot() {
    if (!activeModalDate) return;
    const name = currentName.trim();

    if (!name) {
      showToast("⚠️ Please enter your name at the top first!");
      $nameInput.focus();
      $nameInput.classList.add("input-attention");
      setTimeout(() => $nameInput.classList.remove("input-attention"), 1000);
      return;
    }

    const start = $startTimeInput.value;
    const end   = $endTimeInput.value;

    if (!start || !end || start >= end) {
      showToast("⚠️ Invalid time range selected");
      return;
    }

    // Client-side conflict guard
    const conflict = findConflict(activeModalDate, start, end);
    if (conflict) {
      showToast(`⚠️ Conflict: overlaps with ${conflict.name} (${conflict.startTime}-${conflict.endTime})`);
      return;
    }

    $btnConfirmSlot.disabled = true;
    $syncStatus.innerHTML = '<span class="sync-dot pulsing"></span> Reserving...';

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: activeModalDate,
          startTime: start,
          endTime: end,
          name: name,
          token: clientToken
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to reserve slot");
      }

      showToast(`🚗 Reserved: ${formatDateNice(activeModalDate)} (${start} - ${end})`);
      await fetchBookings(true);
      closeDayModal();
    } catch (err) {
      console.error(err);
      showToast(`❌ ${err.message}`);
      $btnConfirmSlot.disabled = false;
    }
  }

  // ── Cancel My Slot ───────────────────────
  async function handleCancelSlot(bookingId) {
    const booking = allBookings.find(b => b.id === bookingId);
    if (!booking) return;

    if (!isMyBooking(booking)) {
      showToast(`🔒 You cannot cancel a reservation belonging to ${booking.name}!`);
      return;
    }

    if (!confirm(`Cancel your reservation on ${formatDateNice(booking.date)} (${booking.startTime} - ${booking.endTime})?`)) {
      return;
    }

    $syncStatus.innerHTML = '<span class="sync-dot pulsing"></span> Canceling...';

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteBooking",
          id: bookingId,
          name: currentName.trim(),
          token: clientToken
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not cancel booking");
      }

      showToast("🗑️ Reservation canceled");
      await fetchBookings(true);
    } catch (err) {
      console.error(err);
      showToast(`❌ ${err.message}`);
    }
  }

  // ── Legend ───────────────────────────────
  function renderLegend() {
    const year  = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

    const driversThisMonth = new Set();
    allBookings.forEach(b => {
      if (b.date && b.date.startsWith(monthPrefix) && b.name && b.name.trim()) {
        driversThisMonth.add(b.name.trim());
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

    const freeItem = document.createElement("div");
    freeItem.className = "legend-item";
    freeItem.innerHTML = `
      <span class="dot dot-free"></span>
      <span>Available</span>
    `;
    $legend.appendChild(freeItem);
  }

  // ── Board Actions ────────────────────────
  $btnClearMy.addEventListener("click", async () => {
    const driver = currentName.trim();
    if (!driver) {
      showToast("⚠️ Enter your name first!");
      $nameInput.focus();
      return;
    }

    if (!confirm(`Cancel all of your reservations (${driver}) across the board?`)) return;

    $syncStatus.innerHTML = '<span class="sync-dot pulsing"></span> Clearing...';

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clearUser", name: driver })
      });
      const data = await res.json();
      showToast(`🗑️ ${data.message || 'Cleared'}`);
      await fetchBookings(true);
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
  });

  $btnNext.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    renderCalendar();
    renderLegend();
  });

  $btnToday.addEventListener("click", () => {
    viewDate = new Date();
    renderCalendar();
    renderLegend();
  });

  $btnRefresh.addEventListener("click", () => {
    fetchBookings(false);
    showToast("🔄 Board refreshed!");
  });

  // Modal events
  $modalCloseBtn.addEventListener("click", closeDayModal);
  $dayModal.addEventListener("click", (e) => {
    if (e.target === $dayModal) closeDayModal();
  });

  $startTimeInput.addEventListener("input", checkLiveConflict);
  $endTimeInput.addEventListener("input", checkLiveConflict);

  $presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      $startTimeInput.value = btn.dataset.start;
      $endTimeInput.value = btn.dataset.end;
      checkLiveConflict();
    });
  });

  $btnConfirmSlot.addEventListener("click", handleConfirmSlot);

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
