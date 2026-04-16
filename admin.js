const ADMIN_SESSION_KEY = "prime_guard_admin_authenticated";

let employeesCache = [];
let attendanceCache = [];

function isAuthenticated() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

function requireAuth() {
  if (window.location.pathname.endsWith("admin.html") && !isAuthenticated()) {
    window.location.href = "admin-login.html";
  }
}

function handleLogin() {
  const loginForm = document.querySelector("#adminLoginForm");
  const loginError = document.querySelector("#loginError");

  if (!loginForm) {
    return;
  }

  if (isAuthenticated()) {
    window.location.href = "admin.html";
    return;
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.hidden = true;

    const formData = new FormData(loginForm);

    try {
      await window.PrimeGuardApi.loginAdmin(
        String(formData.get("username") || "").trim(),
        String(formData.get("password") || "")
      );
      sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
      window.location.href = "admin.html";
    } catch (error) {
      loginError.hidden = false;
      loginError.textContent = error.message;
    }
  });
}

function handleLogout() {
  const logoutButton = document.querySelector("#logoutButton");

  if (!logoutButton) {
    return;
  }

  logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.href = "admin-login.html";
  });
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function inferRole(designation) {
  const label = String(designation || "").trim().toLowerCase();
  if (label.includes("manager")) {
    return "manager";
  }
  if (label.includes("guard")) {
    return "guard";
  }
  return "employee";
}

function getAttendanceStatus(record) {
  if (record.checkOut) {
    return "Checked Out";
  }
  if (record.checkIn) {
    return "Checked In";
  }
  return "Absent";
}

function getBadgeClass(status) {
  if (status === "Checked Out") {
    return "checked-out";
  }
  if (status === "Checked In") {
    return "checked-in";
  }
  return "absent";
}

function getRecordKey(record) {
  return `${record.employeeId}__${record.date}`;
}

function resetEmployeeForm() {
  const form = document.querySelector("#employeeRegisterForm");
  const idField = document.querySelector("#employeeIdField");
  const submitButton = document.querySelector("#employeeSubmitButton");
  const cancelButton = document.querySelector("#employeeCancelEditButton");
  const message = document.querySelector("#employeeFormMessage");

  if (!form || !idField || !submitButton || !cancelButton || !message) {
    return;
  }

  form.reset();
  idField.value = "";
  submitButton.textContent = "Add Employee";
  cancelButton.hidden = true;
  message.hidden = true;
  message.textContent = "";
  message.className = "employee-form-message";
}

function resetAttendanceForm() {
  const form = document.querySelector("#attendanceAdminForm");
  const keyField = document.querySelector("#attendanceRecordKey");
  const submitButton = document.querySelector("#attendanceSubmitButton");
  const cancelButton = document.querySelector("#attendanceCancelEditButton");
  const dateInput = document.querySelector("#attendanceDateInput");
  const message = document.querySelector("#attendanceFormMessage");

  if (!form || !keyField || !submitButton || !cancelButton || !dateInput || !message) {
    return;
  }

  form.reset();
  keyField.value = "";
  submitButton.textContent = "Save Attendance";
  cancelButton.hidden = true;
  dateInput.value = getTodayDate();
  message.hidden = true;
  message.textContent = "";
  message.className = "employee-form-message";
}

function renderEmployeeDirectory() {
  const employeeDirectory = document.querySelector("#employeeDirectory");
  const employeeCount = document.querySelector("#employeeCount");

  if (!employeeDirectory || !employeeCount) {
    return;
  }

  employeeCount.textContent = String(employeesCache.length);
  employeeDirectory.innerHTML = employeesCache.map((employee) => {
    return `
      <article class="employee-entry" data-employee-id="${employee.employeeId}">
        <div class="employee-entry-top">
          <div>
            <h3>${employee.fullName}</h3>
            <p>${employee.designation}</p>
          </div>
          <span class="employee-chip">ID ${employee.employeeId}</span>
        </div>
        <div class="employee-meta">
          <div>
            <strong>Location</strong>
            <span>${employee.location}</span>
          </div>
          <div>
            <strong>Username</strong>
            <span>${employee.username}</span>
          </div>
          <div>
            <strong>Password</strong>
            <span>${employee.password}</span>
          </div>
          <div>
            <strong>Role</strong>
            <span>${employee.role}</span>
          </div>
        </div>
        <div class="entry-actions">
          <button type="button" class="entry-button edit" data-action="edit-employee" data-employee-id="${employee.employeeId}">Edit</button>
          <button type="button" class="entry-button delete" data-action="delete-employee" data-employee-id="${employee.employeeId}">Delete</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderAttendanceEmployeeSelect() {
  const select = document.querySelector("#attendanceEmployeeSelect");
  if (!select) {
    return;
  }

  select.innerHTML = employeesCache.map((employee) => {
    return `<option value="${employee.employeeId}">${employee.fullName} (${employee.employeeId})</option>`;
  }).join("");
}

function renderAttendanceLocationFilter() {
  const filter = document.querySelector("#attendanceLocationFilter");
  if (!filter) {
    return;
  }

  const currentValue = filter.value;
  const locations = [...new Set(employeesCache.map((employee) => employee.location))].sort();
  filter.innerHTML = `<option value="">All Locations</option>${locations.map((location) => {
    return `<option value="${location}">${location}</option>`;
  }).join("")}`;
  filter.value = locations.includes(currentValue) ? currentValue : "";
}

function renderAttendanceTable() {
  const tableBody = document.querySelector("#attendanceTableBody");
  const locationFilter = document.querySelector("#attendanceLocationFilter");
  const nameFilter = document.querySelector("#attendanceNameFilter");

  if (!tableBody) {
    return;
  }

  const locationValue = locationFilter ? locationFilter.value.trim().toLowerCase() : "";
  const nameValue = nameFilter ? nameFilter.value.trim().toLowerCase() : "";

  const rows = attendanceCache
    .slice()
    .sort((left, right) => `${right.date}${right.checkIn}`.localeCompare(`${left.date}${left.checkIn}`))
    .filter((record) => {
      const matchLocation = !locationValue || record.location.toLowerCase() === locationValue;
      const matchName = !nameValue || record.fullName.toLowerCase().includes(nameValue);
      return matchLocation && matchName;
    });

  if (!rows.length) {
    tableBody.innerHTML = `<tr><td colspan="9">No attendance records found for the selected filters.</td></tr>`;
    return;
  }

  tableBody.innerHTML = rows.map((record) => {
    const status = getAttendanceStatus(record);
    const recordKey = getRecordKey(record);
    return `
      <tr data-record-key="${recordKey}">
        <td>${record.date}</td>
        <td>${record.employeeId}</td>
        <td>${record.fullName}</td>
        <td>${record.designation}</td>
        <td>${record.location}</td>
        <td>${record.checkIn || "-"}</td>
        <td>${record.checkOut || "-"}</td>
        <td><span class="attendance-badge ${getBadgeClass(status)}">${status}</span></td>
        <td>
          <div class="attendance-action-row">
            <button type="button" class="entry-button edit" data-action="edit-attendance" data-record-key="${recordKey}">Edit</button>
            <button type="button" class="entry-button delete" data-action="delete-attendance" data-record-key="${recordKey}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function loadEmployees() {
  const response = await window.PrimeGuardApi.getEmployees();
  employeesCache = response.items || [];
  renderEmployeeDirectory();
  renderAttendanceEmployeeSelect();
  renderAttendanceLocationFilter();
}

async function loadAttendance(filters = {}) {
  const response = await window.PrimeGuardApi.getAttendance(filters);
  attendanceCache = response.items || [];
  renderAttendanceTable();
}

function handleAttendanceFilters() {
  const locationFilter = document.querySelector("#attendanceLocationFilter");
  const nameFilter = document.querySelector("#attendanceNameFilter");

  if (locationFilter) {
    locationFilter.addEventListener("change", renderAttendanceTable);
  }
  if (nameFilter) {
    nameFilter.addEventListener("input", renderAttendanceTable);
  }
}

function handleEmployeeRegistration() {
  const form = document.querySelector("#employeeRegisterForm");
  const formMessage = document.querySelector("#employeeFormMessage");
  const idField = document.querySelector("#employeeIdField");

  if (!form || !formMessage || !idField) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      fullName: String(formData.get("fullName") || "").trim(),
      designation: String(formData.get("designation") || "").trim(),
      location: String(formData.get("location") || "").trim(),
      username: String(formData.get("username") || "").trim(),
      password: String(formData.get("password") || ""),
      role: inferRole(String(formData.get("designation") || ""))
    };

    try {
      if (idField.value) {
        await window.PrimeGuardApi.updateEmployee(idField.value, payload);
        formMessage.textContent = `Employee ${idField.value} updated successfully.`;
      } else {
        const result = await window.PrimeGuardApi.createEmployee(payload);
        formMessage.textContent = `Employee added successfully. Generated ID: ${result.item.employeeId}`;
      }
      formMessage.hidden = false;
      formMessage.className = "employee-form-message success";
      resetEmployeeForm();
      await loadEmployees();
      await loadAttendance();
    } catch (error) {
      formMessage.hidden = false;
      formMessage.className = "employee-form-message error";
      formMessage.textContent = error.message;
    }
  });
}

function handleAttendanceAdminForm() {
  const form = document.querySelector("#attendanceAdminForm");
  const dateInput = document.querySelector("#attendanceDateInput");
  const message = document.querySelector("#attendanceFormMessage");
  const keyField = document.querySelector("#attendanceRecordKey");

  if (!form || !dateInput || !message || !keyField) {
    return;
  }

  dateInput.value = getTodayDate();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      employeeId: String(formData.get("employeeId") || ""),
      date: String(formData.get("attendanceDate") || ""),
      checkIn: String(formData.get("checkInTime") || ""),
      checkOut: String(formData.get("checkOutTime") || "")
    };

    if (payload.checkOut && payload.checkIn && payload.checkOut < payload.checkIn) {
      message.hidden = false;
      message.className = "employee-form-message error";
      message.textContent = "Check-out time cannot be earlier than check-in time.";
      return;
    }

    try {
      if (keyField.value) {
        await window.PrimeGuardApi.updateAttendance(payload.employeeId, payload.date, payload);
        message.textContent = "Attendance updated successfully.";
      } else {
        await window.PrimeGuardApi.saveAttendance(payload);
        message.textContent = "Attendance saved successfully.";
      }
      message.hidden = false;
      message.className = "employee-form-message success";
      resetAttendanceForm();
      await loadAttendance();
    } catch (error) {
      message.hidden = false;
      message.className = "employee-form-message error";
      message.textContent = error.message;
    }
  });
}

function handleTabs() {
  const tabs = document.querySelectorAll(".dashboard-tab");
  const panels = document.querySelectorAll(".tab-panel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");
      tabs.forEach((item) => item.classList.remove("active"));
      panels.forEach((panel) => panel.classList.remove("active"));
      tab.classList.add("active");
      const panel = document.querySelector(`#tab-${target}`);
      if (panel) {
        panel.classList.add("active");
      }
    });
  });
}

function handleEmployeeDirectoryActions() {
  const directory = document.querySelector("#employeeDirectory");
  const form = document.querySelector("#employeeRegisterForm");
  const idField = document.querySelector("#employeeIdField");
  const submitButton = document.querySelector("#employeeSubmitButton");
  const cancelButton = document.querySelector("#employeeCancelEditButton");

  if (!directory || !form || !idField || !submitButton || !cancelButton) {
    return;
  }

  directory.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const employeeId = button.getAttribute("data-employee-id") || "";
    const employee = employeesCache.find((item) => item.employeeId === employeeId);
    if (!employee) {
      return;
    }

    if (button.getAttribute("data-action") === "edit-employee") {
      form.elements.fullName.value = employee.fullName;
      form.elements.designation.value = employee.designation;
      form.elements.location.value = employee.location;
      form.elements.username.value = employee.username;
      form.elements.password.value = employee.password;
      idField.value = employee.employeeId;
      submitButton.textContent = "Update Employee";
      cancelButton.hidden = false;
      document.querySelector('[data-tab="employees"]').click();
    }

    if (button.getAttribute("data-action") === "delete-employee") {
      await window.PrimeGuardApi.deleteEmployee(employeeId);
      resetEmployeeForm();
      await loadEmployees();
      await loadAttendance();
    }
  });

  cancelButton.addEventListener("click", resetEmployeeForm);
}

function handleAttendanceTableActions() {
  const tableBody = document.querySelector("#attendanceTableBody");
  const form = document.querySelector("#attendanceAdminForm");
  const keyField = document.querySelector("#attendanceRecordKey");
  const submitButton = document.querySelector("#attendanceSubmitButton");
  const cancelButton = document.querySelector("#attendanceCancelEditButton");

  if (!tableBody || !form || !keyField || !submitButton || !cancelButton) {
    return;
  }

  tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const recordKey = button.getAttribute("data-record-key") || "";
    const record = attendanceCache.find((item) => getRecordKey(item) === recordKey);
    if (!record) {
      return;
    }

    if (button.getAttribute("data-action") === "edit-attendance") {
      form.elements.employeeId.value = record.employeeId;
      form.elements.attendanceDate.value = record.date;
      form.elements.checkInTime.value = record.checkIn || "";
      form.elements.checkOutTime.value = record.checkOut || "";
      keyField.value = recordKey;
      submitButton.textContent = "Update Attendance";
      cancelButton.hidden = false;
      document.querySelector('[data-tab="attendance"]').click();
    }

    if (button.getAttribute("data-action") === "delete-attendance") {
      await window.PrimeGuardApi.deleteAttendance(record.employeeId, record.date);
      resetAttendanceForm();
      await loadAttendance();
    }
  });

  cancelButton.addEventListener("click", resetAttendanceForm);
}

async function initializeDashboard() {
  handleTabs();
  handleLogout();
  handleEmployeeRegistration();
  handleAttendanceAdminForm();
  handleAttendanceFilters();
  handleEmployeeDirectoryActions();
  handleAttendanceTableActions();
  await loadEmployees();
  resetAttendanceForm();
  await loadAttendance();
}

requireAuth();
handleLogin();
if (window.location.pathname.endsWith("admin.html")) {
  initializeDashboard();
}
