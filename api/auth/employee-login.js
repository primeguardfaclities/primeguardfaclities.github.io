const { applyCors, getSupabaseAdmin, readBody, sendJson } = require("../_lib/service");

module.exports = async (req, res) => {
  if (applyCors(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = await readBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("users")
      .select("employee_id, full_name, designation, location, username, password, role")
      .eq("username", username)
      .eq("password", password)
      .neq("role", "manager")
      .limit(1);

    if (error) {
      throw error;
    }

    if (!data || !data.length) {
      sendJson(res, 401, { error: "Invalid employee credentials." });
      return;
    }

    const row = data[0];
    sendJson(res, 200, {
      user: {
        employeeId: row.employee_id,
        fullName: row.full_name,
        designation: row.designation,
        location: row.location,
        username: row.username,
        password: row.password,
        role: row.role
      }
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unable to complete employee login." });
  }
};
