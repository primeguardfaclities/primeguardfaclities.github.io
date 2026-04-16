const EMPLOYEE_SESSION_KEY = "prime_guard_employee_authenticated";
const EMPLOYEE_PROFILE_KEY = "prime_guard_employee_profile";

function isEmployeeAuthenticated() {
  return sessionStorage.getItem(EMPLOYEE_SESSION_KEY) === "true";
}

function getCurrentEmployee() {
  const rawProfile = sessionStorage.getItem(EMPLOYEE_PROFILE_KEY);
  if (!rawProfile) {
    return null;
  }
  try {
    return JSON.parse(rawProfile);
  } catch (error) {
    return null;
  }
}

function requireEmployeeAuth() {
  if (window.location.pathname.endsWith("employee-portal.html") && !isEmployeeAuthenticated()) {
    window.location.href = "employee-login.html";
  }
}

function handleEmployeeLogin() {
  const loginForm = document.querySelector("#employeeLoginForm");
  const loginError = document.querySelector("#employeeLoginError");

  if (!loginForm) {
    return;
  }

  if (isEmployeeAuthenticated()) {
    window.location.href = "employee-portal.html";
    return;
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.hidden = true;
    const formData = new FormData(loginForm);

    try {
      const result = await window.PrimeGuardApi.loginEmployee(
        String(formData.get("username") || "").trim(),
        String(formData.get("password") || "")
      );
      sessionStorage.setItem(EMPLOYEE_SESSION_KEY, "true");
      sessionStorage.setItem(EMPLOYEE_PROFILE_KEY, JSON.stringify(result.user));
      window.location.href = "employee-portal.html";
    } catch (error) {
      loginError.hidden = false;
      loginError.textContent = error.message;
    }
  });
}

function handleEmployeeLogout() {
  const logoutButton = document.querySelector("#employeeLogoutButton");
  if (!logoutButton) {
    return;
  }
  logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem(EMPLOYEE_SESSION_KEY);
    sessionStorage.removeItem(EMPLOYEE_PROFILE_KEY);
    window.location.href = "employee-login.html";
  });
}

function setEmployeeWelcomeName() {
  const welcomeName = document.querySelector("#employeeWelcomeName");
  const employee = getCurrentEmployee();
  if (!welcomeName || !employee) {
    return;
  }
  welcomeName.textContent = employee.fullName;
}

function setEmployeeProfile() {
  const profileList = document.querySelector("#employeeProfileDetails");
  const employee = getCurrentEmployee();

  if (!profileList) {
    return;
  }

  if (!employee) {
    profileList.innerHTML = `
      <li>Employee ID: -</li>
      <li>Designation: -</li>
      <li>Location: -</li>
      <li>Username: -</li>
    `;
    return;
  }

  profileList.innerHTML = `
    <li>Employee ID: ${employee.employeeId}</li>
    <li>Designation: ${employee.designation}</li>
    <li>Location: ${employee.location}</li>
    <li>Username: ${employee.username}</li>
  `;
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

async function renderEmployeeAttendance() {
  const tableBody = document.querySelector("#employeeAttendanceTableBody");
  const employee = getCurrentEmployee();

  if (!tableBody || !employee) {
    return;
  }

  const response = await window.PrimeGuardApi.getAttendance({ employeeId: employee.employeeId });
  const rows = (response.items || []).sort((left, right) => `${right.date}${right.checkIn}`.localeCompare(`${left.date}${left.checkIn}`));

  if (!rows.length) {
    tableBody.innerHTML = `<tr><td colspan="4">No attendance records available.</td></tr>`;
    return;
  }

  tableBody.innerHTML = rows.map((record) => {
    const status = getAttendanceStatus(record);
    return `
      <tr>
        <td>${record.date}</td>
        <td>${record.checkIn || "-"}</td>
        <td>${record.checkOut || "-"}</td>
        <td><span class="attendance-badge ${getBadgeClass(status)}">${status}</span></td>
      </tr>
    `;
  }).join("");
}

async function initializeEmployeePortal() {
  handleEmployeeLogout();
  setEmployeeWelcomeName();
  setEmployeeProfile();
  await renderEmployeeAttendance();
}

requireEmployeeAuth();
handleEmployeeLogin();
if (window.location.pathname.endsWith("employee-portal.html")) {
  initializeEmployeePortal();
}
