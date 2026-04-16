const MANAGER_SESSION_KEY = "prime_guard_manager_authenticated";
const MANAGER_PROFILE_KEY = "prime_guard_manager_profile";

function isManagerAuthenticated() {
  return sessionStorage.getItem(MANAGER_SESSION_KEY) === "true";
}

function getManagerProfile() {
  const raw = sessionStorage.getItem(MANAGER_PROFILE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function requireManagerAuth() {
  if (window.location.pathname.endsWith("manager.html") && !isManagerAuthenticated()) {
    window.location.href = "manager-login.html";
  }
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getTimeWindow() {
  const now = new Date();
  const minDate = new Date(now.getTime() - (2 * 60 * 60 * 1000));
  const sameDay = minDate.toDateString() === now.toDateString();
  return {
    min: sameDay ? formatTime(minDate) : "00:00",
    max: formatTime(now)
  };
}

function handleManagerLogin() {
  const loginForm = document.querySelector("#managerLoginForm");
  const loginError = document.querySelector("#managerLoginError");

  if (!loginForm) {
    return;
  }

  if (isManagerAuthenticated()) {
    window.location.href = "manager.html";
    return;
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.hidden = true;
    const formData = new FormData(loginForm);

    try {
      const result = await window.PrimeGuardApi.loginManager(
        String(formData.get("username") || "").trim(),
        String(formData.get("password") || "")
      );
      sessionStorage.setItem(MANAGER_SESSION_KEY, "true");
      sessionStorage.setItem(MANAGER_PROFILE_KEY, JSON.stringify(result.user));
      window.location.href = "manager.html";
    } catch (error) {
      loginError.hidden = false;
      loginError.textContent = error.message;
    }
  });
}

function handleManagerLogout() {
  const logoutButton = document.querySelector("#managerLogoutButton");
  if (!logoutButton) {
    return;
  }
  logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem(MANAGER_SESSION_KEY);
    sessionStorage.removeItem(MANAGER_PROFILE_KEY);
    window.location.href = "manager-login.html";
  });
}

function setManagerDateNote() {
  const dateNote = document.querySelector("#managerDateNote");
  if (!dateNote) {
    return;
  }
  dateNote.textContent = `Managers can only mark attendance for ${new Date().toDateString()}. Check-in and check-out times must be between the current time and up to 2 hours earlier.`;
}

function setManagerLocationNote() {
  const note = document.querySelector("#managerLocationNote");
  const profile = getManagerProfile();
  if (!note || !profile) {
    return;
  }
  note.textContent = `${profile.fullName} can only mark attendance for employees assigned to ${profile.location}.`;
}

function getAttendanceStatus(record) {
  if (record && record.checkOut) {
    return "Checked Out";
  }
  if (record && record.checkIn) {
    return "Checked In";
  }
  return "Absent";
}

function isWithinWindow(timeValue) {
  const windowRange = getTimeWindow();
  return timeValue >= windowRange.min && timeValue <= windowRange.max;
}

async function getManagerEmployees() {
  const profile = getManagerProfile();
  if (!profile) {
    return [];
  }
  const response = await window.PrimeGuardApi.getEmployees();
  return (response.items || []).filter((employee) => {
    return employee.location === profile.location && employee.role !== "manager";
  });
}

async function renderManagerAttendance() {
  const container = document.querySelector("#managerAttendanceGrid");
  const profile = getManagerProfile();
  if (!container || !profile) {
    return;
  }

  const employees = await getManagerEmployees();
  const attendanceResponse = await window.PrimeGuardApi.getAttendance({ location: profile.location });
  const attendanceItems = attendanceResponse.items || [];
  const today = getTodayDate();
  const windowRange = getTimeWindow();

  if (!employees.length) {
    container.innerHTML = `<article class="dashboard-card"><p>No employees are currently assigned to ${profile.location}.</p></article>`;
    return;
  }

  container.innerHTML = employees.map((employee) => {
    const record = attendanceItems.find((item) => item.employeeId === employee.employeeId && item.date === today);
    const checkInValue = record && record.checkIn ? record.checkIn : windowRange.max;
    const checkOutValue = record && record.checkOut ? record.checkOut : windowRange.max;
    const status = getAttendanceStatus(record);

    return `
      <article class="manager-card" data-employee-id="${employee.employeeId}">
        <div class="employee-entry-top">
          <div>
            <h3>${employee.fullName}</h3>
            <p>${employee.designation} · ${employee.location}</p>
          </div>
          <span class="employee-chip">ID ${employee.employeeId}</span>
        </div>
        <div class="manager-fields">
          <label>
            <span>Check-In</span>
            <input type="time" class="manager-checkin-time" value="${checkInValue}" min="${windowRange.min}" max="${windowRange.max}">
          </label>
          <label>
            <span>Check-Out</span>
            <input type="time" class="manager-checkout-time" value="${checkOutValue}" min="${windowRange.min}" max="${windowRange.max}">
          </label>
        </div>
        <div class="manager-actions">
          <button type="button" class="auth-button manager-action" data-action="checkin">Check In</button>
          <button type="button" class="logout-button manager-action" data-action="checkout">Check Out</button>
        </div>
        <p class="manager-status">Today: ${status}${record && record.checkIn ? ` | In ${record.checkIn}` : ""}${record && record.checkOut ? ` | Out ${record.checkOut}` : ""}</p>
      </article>
    `;
  }).join("");
}

function handleManagerAttendance() {
  const container = document.querySelector("#managerAttendanceGrid");
  if (!container) {
    return;
  }

  container.addEventListener("click", async (event) => {
    const button = event.target.closest(".manager-action");
    if (!button) {
      return;
    }

    const card = button.closest(".manager-card");
    const employeeId = card ? card.getAttribute("data-employee-id") : "";
    const employees = await getManagerEmployees();
    const employee = employees.find((item) => item.employeeId === employeeId);

    if (!card || !employee) {
      return;
    }

    const checkInValue = card.querySelector(".manager-checkin-time")?.value || "";
    const checkOutValue = card.querySelector(".manager-checkout-time")?.value || "";
    const today = getTodayDate();
    const attendanceResponse = await window.PrimeGuardApi.getAttendance({ employeeId });
    const existing = (attendanceResponse.items || []).find((item) => item.date === today);

    if (button.getAttribute("data-action") === "checkin") {
      if (!checkInValue || !isWithinWindow(checkInValue)) {
        window.alert("Check-in time must be within the last 2 hours and not later than the current time.");
        return;
      }
      await window.PrimeGuardApi.saveAttendance({
        employeeId,
        date: today,
        checkIn: checkInValue,
        checkOut: existing ? existing.checkOut : ""
      });
    }

    if (button.getAttribute("data-action") === "checkout") {
      if (!existing || !existing.checkIn) {
        window.alert("Please mark check-in first for today.");
        return;
      }
      if (!checkOutValue || !isWithinWindow(checkOutValue)) {
        window.alert("Check-out time must be within the last 2 hours and not later than the current time.");
        return;
      }
      if (checkOutValue < existing.checkIn) {
        window.alert("Check-out time cannot be earlier than check-in time.");
        return;
      }
      await window.PrimeGuardApi.updateAttendance(employeeId, today, {
        employeeId,
        date: today,
        checkIn: existing.checkIn,
        checkOut: checkOutValue
      });
    }

    await renderManagerAttendance();
  });
}

async function initializeManagerPage() {
  handleManagerLogout();
  setManagerLocationNote();
  setManagerDateNote();
  handleManagerAttendance();
  await renderManagerAttendance();
}

requireManagerAuth();
handleManagerLogin();
if (window.location.pathname.endsWith("manager.html")) {
  initializeManagerPage();
}
