const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const HOST = "127.0.0.1";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "prime_guard.db");

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "PrimeGuard@2026";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const DEFAULT_USERS = [
  {
    employee_id: "100001",
    full_name: "Employee",
    designation: "Security Guard",
    location: "Rohtak",
    username: "employee",
    password: "PrimeEmployee@2026",
    role: "employee"
  },
  {
    employee_id: "100002",
    full_name: "Guard 1",
    designation: "Security Guard",
    location: "New Delhi",
    username: "guard1",
    password: "Guard@2026",
    role: "guard"
  },
  {
    employee_id: "100003",
    full_name: "Rohtak Manager",
    designation: "Manager",
    location: "Rohtak",
    username: "manager",
    password: "Manager@2026",
    role: "manager"
  },
  {
    employee_id: "100004",
    full_name: "New Delhi Manager",
    designation: "Manager",
    location: "New Delhi",
    username: "manager-delhi",
    password: "ManagerDelhi@2026",
    role: "manager"
  },
  {
    employee_id: "100005",
    full_name: "Zirakpur Manager",
    designation: "Manager",
    location: "Zirakpur",
    username: "manager-zirakpur",
    password: "ManagerZirakpur@2026",
    role: "manager"
  }
];

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  json(res, 404, { error: "Not found" });
}

function badRequest(res, message) {
  json(res, 400, { error: message });
}

function inferRole(role, designation) {
  const direct = String(role || "").trim().toLowerCase();
  if (["employee", "guard", "manager"].includes(direct)) {
    return direct;
  }
  const label = String(designation || "").trim().toLowerCase();
  if (label.includes("manager")) {
    return "manager";
  }
  if (label.includes("guard")) {
    return "guard";
  }
  return "employee";
}

function runSql(sql) {
  return execFileSync("sqlite3", [DB_PATH, sql], { encoding: "utf8" });
}

function allSql(sql) {
  const output = execFileSync("sqlite3", ["-json", DB_PATH, sql], { encoding: "utf8" }).trim();
  return output ? JSON.parse(output) : [];
}

function initDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  runSql(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      employee_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      designation TEXT NOT NULL,
      location TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance (
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      full_name TEXT NOT NULL,
      designation TEXT NOT NULL,
      location TEXT NOT NULL,
      check_in TEXT DEFAULT '',
      check_out TEXT DEFAULT '',
      PRIMARY KEY (employee_id, date)
    );
  `);

  DEFAULT_USERS.forEach((user) => {
    runSql(`
      INSERT OR IGNORE INTO users (
        employee_id, full_name, designation, location, username, password, role
      ) VALUES (
        '${sqlEscape(user.employee_id)}',
        '${sqlEscape(user.full_name)}',
        '${sqlEscape(user.designation)}',
        '${sqlEscape(user.location)}',
        '${sqlEscape(user.username)}',
        '${sqlEscape(user.password)}',
        '${sqlEscape(user.role)}'
      );
    `);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function getNextEmployeeId() {
  const rows = allSql("SELECT employee_id FROM users ORDER BY CAST(employee_id AS INTEGER) DESC LIMIT 1;");
  const last = rows.length ? Number(rows[0].employee_id) : 100000;
  return String(last + 1).padStart(6, "0");
}

function getUsers() {
  return allSql("SELECT employee_id, full_name, designation, location, username, password, role FROM users ORDER BY CAST(employee_id AS INTEGER) ASC;");
}

function getUserByEmployeeId(employeeId) {
  const rows = allSql(`
    SELECT employee_id, full_name, designation, location, username, password, role
    FROM users
    WHERE employee_id = '${sqlEscape(employeeId)}'
    LIMIT 1;
  `);
  return rows[0] || null;
}

function getUserByCredentials(username, password, role) {
  const roleClause = role ? `AND role = '${sqlEscape(role)}'` : "";
  const rows = allSql(`
    SELECT employee_id, full_name, designation, location, username, password, role
    FROM users
    WHERE username = '${sqlEscape(username)}'
      AND password = '${sqlEscape(password)}'
      ${roleClause}
    LIMIT 1;
  `);
  return rows[0] || null;
}

function getAttendance({ location = "", name = "", employeeId = "" } = {}) {
  const clauses = [];

  if (location) {
    clauses.push(`location = '${sqlEscape(location)}'`);
  }

  if (name) {
    clauses.push(`LOWER(full_name) LIKE '%${sqlEscape(name.toLowerCase())}%'`);
  }

  if (employeeId) {
    clauses.push(`employee_id = '${sqlEscape(employeeId)}'`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  return allSql(`
    SELECT employee_id, date, full_name, designation, location, check_in, check_out
    FROM attendance
    ${where}
    ORDER BY date DESC, check_in DESC;
  `);
}

function saveUser(payload, employeeId = "") {
  const fullName = String(payload.fullName || "").trim();
  const designation = String(payload.designation || "").trim();
  const location = String(payload.location || "").trim();
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");
  const role = inferRole(payload.role, designation);

  if (!fullName || !designation || !location || !username || !password) {
    throw new Error("All employee fields are required.");
  }

  if (employeeId) {
    runSql(`
      UPDATE users
      SET
        full_name = '${sqlEscape(fullName)}',
        designation = '${sqlEscape(designation)}',
        location = '${sqlEscape(location)}',
        username = '${sqlEscape(username)}',
        password = '${sqlEscape(password)}',
        role = '${sqlEscape(role)}'
      WHERE employee_id = '${sqlEscape(employeeId)}';

      UPDATE attendance
      SET
        full_name = '${sqlEscape(fullName)}',
        designation = '${sqlEscape(designation)}',
        location = '${sqlEscape(location)}'
      WHERE employee_id = '${sqlEscape(employeeId)}';
    `);

    return getUserByEmployeeId(employeeId);
  }

  const newEmployeeId = getNextEmployeeId();
  runSql(`
    INSERT INTO users (
      employee_id, full_name, designation, location, username, password, role
    ) VALUES (
      '${sqlEscape(newEmployeeId)}',
      '${sqlEscape(fullName)}',
      '${sqlEscape(designation)}',
      '${sqlEscape(location)}',
      '${sqlEscape(username)}',
      '${sqlEscape(password)}',
      '${sqlEscape(role)}'
    );
  `);

  return getUserByEmployeeId(newEmployeeId);
}

function deleteUser(employeeId) {
  runSql(`
    DELETE FROM attendance WHERE employee_id = '${sqlEscape(employeeId)}';
    DELETE FROM users WHERE employee_id = '${sqlEscape(employeeId)}';
  `);
}

function saveAttendanceRecord(payload, employeeIdFromPath = "", dateFromPath = "") {
  const employeeId = employeeIdFromPath || String(payload.employeeId || "").trim();
  const date = dateFromPath || String(payload.date || "").trim();
  const checkIn = String(payload.checkIn || "").trim();
  const checkOut = String(payload.checkOut || "").trim();
  const user = getUserByEmployeeId(employeeId);

  if (!user) {
    throw new Error("Employee not found.");
  }

  if (!date) {
    throw new Error("Attendance date is required.");
  }

  runSql(`
    INSERT INTO attendance (
      employee_id, date, full_name, designation, location, check_in, check_out
    ) VALUES (
      '${sqlEscape(employeeId)}',
      '${sqlEscape(date)}',
      '${sqlEscape(user.full_name)}',
      '${sqlEscape(user.designation)}',
      '${sqlEscape(user.location)}',
      '${sqlEscape(checkIn)}',
      '${sqlEscape(checkOut)}'
    )
    ON CONFLICT(employee_id, date) DO UPDATE SET
      full_name = excluded.full_name,
      designation = excluded.designation,
      location = excluded.location,
      check_in = excluded.check_in,
      check_out = excluded.check_out;
  `);
}

function deleteAttendance(employeeId, date) {
  runSql(`
    DELETE FROM attendance
    WHERE employee_id = '${sqlEscape(employeeId)}'
      AND date = '${sqlEscape(date)}';
  `);
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    employeeId: user.employee_id,
    fullName: user.full_name,
    designation: user.designation,
    location: user.location,
    username: user.username,
    password: user.password,
    role: user.role
  };
}

function sanitizeAttendance(record) {
  const status = record.check_out ? "Checked Out" : (record.check_in ? "Checked In" : "Absent");
  return {
    employeeId: record.employee_id,
    date: record.date,
    fullName: record.full_name,
    designation: record.designation,
    location: record.location,
    checkIn: record.check_in || "",
    checkOut: record.check_out || "",
    status
  };
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/admin-login") {
    const body = await readBody(req);
    if (body.username === ADMIN_USERNAME && body.password === ADMIN_PASSWORD) {
      json(res, 200, { ok: true, admin: { username: ADMIN_USERNAME } });
      return true;
    }
    json(res, 401, { error: "Invalid admin credentials." });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/manager-login") {
    const body = await readBody(req);
    const user = getUserByCredentials(body.username, body.password, "manager");
    if (!user) {
      json(res, 401, { error: "Invalid manager credentials." });
      return true;
    }
    json(res, 200, { ok: true, user: sanitizeUser(user) });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/employee-login") {
    const body = await readBody(req);
    const user = getUserByCredentials(body.username, body.password);
    if (!user || user.role === "manager") {
      json(res, 401, { error: "Invalid employee credentials." });
      return true;
    }
    json(res, 200, { ok: true, user: sanitizeUser(user) });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/employees") {
    const users = getUsers().map(sanitizeUser);
    json(res, 200, { items: users });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/employees") {
    const body = await readBody(req);
    const user = sanitizeUser(saveUser(body));
    json(res, 200, { item: user });
    return true;
  }

  if (req.method === "PUT" && url.pathname.startsWith("/api/employees/")) {
    const employeeId = decodeURIComponent(url.pathname.split("/").pop());
    const body = await readBody(req);
    const user = sanitizeUser(saveUser(body, employeeId));
    json(res, 200, { item: user });
    return true;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/employees/")) {
    const employeeId = decodeURIComponent(url.pathname.split("/").pop());
    deleteUser(employeeId);
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/attendance") {
    const records = getAttendance({
      location: url.searchParams.get("location") || "",
      name: url.searchParams.get("name") || "",
      employeeId: url.searchParams.get("employeeId") || ""
    }).map(sanitizeAttendance);
    json(res, 200, { items: records });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/attendance") {
    const body = await readBody(req);
    saveAttendanceRecord(body);
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "PUT" && url.pathname.startsWith("/api/attendance/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const employeeId = decodeURIComponent(parts[2] || "");
    const date = decodeURIComponent(parts[3] || "");
    const body = await readBody(req);
    saveAttendanceRecord(body, employeeId, date);
    json(res, 200, { ok: true });
    return true;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/attendance/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const employeeId = decodeURIComponent(parts[2] || "");
    const date = decodeURIComponent(parts[3] || "");
    deleteAttendance(employeeId, date);
    json(res, 200, { ok: true });
    return true;
  }

  return false;
}

function serveStatic(req, res, url) {
  let filePath = path.join(ROOT, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname));

  if (!filePath.startsWith(ROOT)) {
    notFound(res);
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      notFound(res);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mimeType });
    res.end(content);
  });
}

initDatabase();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url);
      if (!handled) {
        notFound(res);
      }
      return;
    }

    serveStatic(req, res, url);
  } catch (error) {
    const message = error && error.message ? error.message : "Server error";
    if (message === "Invalid JSON" || message.includes("required") || message.includes("not found") || message.includes("exists")) {
      badRequest(res, message);
      return;
    }
    json(res, 500, { error: message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Prime Guard server running on http://${HOST}:${PORT}`);
});
