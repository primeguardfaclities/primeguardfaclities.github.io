const { createClient } = require("@supabase/supabase-js");

const ADMIN_USERNAME = process.env.PRIME_GUARD_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.PRIME_GUARD_ADMIN_PASSWORD || "PrimeGuard@2026";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function getAllowedOrigin(origin) {
  if (!origin) {
    return ALLOWED_ORIGINS[0] || "*";
  }

  if (!ALLOWED_ORIGINS.length || ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  return "";
}

function applyCors(req, res) {
  const origin = getAllowedOrigin(req.headers.origin || "");

  if (req.headers.origin && !origin) {
    sendJson(res, 403, { error: "Origin not allowed." });
    return true;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }

  return false;
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

async function readBody(req) {
  if (typeof req.body === "object" && req.body !== null) {
    return req.body;
  }

  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"));
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
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

function normalizeUser(row) {
  return {
    employeeId: row.employee_id,
    fullName: row.full_name,
    designation: row.designation,
    location: row.location,
    username: row.username,
    password: row.password,
    role: row.role
  };
}

function normalizeAttendance(row) {
  return {
    employeeId: row.employee_id,
    date: row.date,
    fullName: row.full_name,
    designation: row.designation,
    location: row.location,
    checkIn: row.check_in || "",
    checkOut: row.check_out || ""
  };
}

async function getNextEmployeeId(supabase) {
  const { data, error } = await supabase
    .from("users")
    .select("employee_id")
    .order("employee_id", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const lastId = data && data.length ? Number(data[0].employee_id) : 100000;
  return String(lastId + 1).padStart(6, "0");
}

async function listUsers(supabase) {
  const { data, error } = await supabase
    .from("users")
    .select("employee_id, full_name, designation, location, username, password, role")
    .order("employee_id", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(normalizeUser);
}

async function findUserByCredentials(supabase, username, password, role) {
  let query = supabase
    .from("users")
    .select("employee_id, full_name, designation, location, username, password, role")
    .eq("username", username)
    .eq("password", password)
    .limit(1);

  if (role) {
    query = query.eq("role", role);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data && data.length ? normalizeUser(data[0]) : null;
}

async function findUserByEmployeeId(supabase, employeeId) {
  const { data, error } = await supabase
    .from("users")
    .select("employee_id, full_name, designation, location, username, password, role")
    .eq("employee_id", employeeId)
    .limit(1);

  if (error) {
    throw error;
  }

  return data && data.length ? normalizeUser(data[0]) : null;
}

async function saveUserRecord(supabase, payload, employeeId) {
  const fullName = String(payload.fullName || "").trim();
  const designation = String(payload.designation || "").trim();
  const location = String(payload.location || "").trim();
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");
  const role = inferRole(payload.role, designation);

  if (!fullName || !designation || !location || !username || !password) {
    throw new Error("All employee fields are required.");
  }

  const record = {
    employee_id: employeeId || (await getNextEmployeeId(supabase)),
    full_name: fullName,
    designation,
    location,
    username,
    password,
    role
  };

  const { data, error } = await supabase
    .from("users")
    .upsert(record, { onConflict: "employee_id" })
    .select("employee_id, full_name, designation, location, username, password, role")
    .single();

  if (error) {
    throw error;
  }

  return normalizeUser(data);
}

async function deleteUserRecord(supabase, employeeId) {
  const { error: attendanceError } = await supabase
    .from("attendance")
    .delete()
    .eq("employee_id", employeeId);

  if (attendanceError) {
    throw attendanceError;
  }

  const { error } = await supabase
    .from("users")
    .delete()
    .eq("employee_id", employeeId);

  if (error) {
    throw error;
  }
}

async function listAttendance(supabase, filters = {}) {
  let query = supabase
    .from("attendance")
    .select("employee_id, date, full_name, designation, location, check_in, check_out")
    .order("date", { ascending: false })
    .order("check_in", { ascending: false });

  if (filters.location) {
    query = query.eq("location", filters.location);
  }

  if (filters.employeeId) {
    query = query.eq("employee_id", filters.employeeId);
  }

  if (filters.name) {
    query = query.ilike("full_name", `%${filters.name}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data || []).map(normalizeAttendance);
}

async function saveAttendanceRecord(supabase, payload, employeeId, date) {
  const resolvedEmployeeId = String(employeeId || payload.employeeId || "").trim();
  const resolvedDate = String(date || payload.date || "").trim();
  const checkIn = String(payload.checkIn || "").trim();
  const checkOut = String(payload.checkOut || "").trim();

  if (!resolvedEmployeeId || !resolvedDate) {
    throw new Error("Employee and date are required.");
  }

  const user = await findUserByEmployeeId(supabase, resolvedEmployeeId);
  if (!user) {
    throw new Error("Employee not found.");
  }

  const record = {
    employee_id: resolvedEmployeeId,
    date: resolvedDate,
    full_name: user.fullName,
    designation: user.designation,
    location: user.location,
    check_in: checkIn,
    check_out: checkOut
  };

  const { data, error } = await supabase
    .from("attendance")
    .upsert(record, { onConflict: "employee_id,date" })
    .select("employee_id, date, full_name, designation, location, check_in, check_out")
    .single();

  if (error) {
    throw error;
  }

  return normalizeAttendance(data);
}

async function deleteAttendanceRecord(supabase, employeeId, date) {
  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("employee_id", employeeId)
    .eq("date", date);

  if (error) {
    throw error;
  }
}

module.exports = {
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  applyCors,
  deleteAttendanceRecord,
  deleteUserRecord,
  findUserByCredentials,
  findUserByEmployeeId,
  getSupabaseAdmin,
  inferRole,
  listAttendance,
  listUsers,
  readBody,
  saveAttendanceRecord,
  saveUserRecord,
  sendJson
};
