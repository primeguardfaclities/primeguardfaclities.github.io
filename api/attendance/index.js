const { applyCors, getSupabaseAdmin, listAttendance, readBody, saveAttendanceRecord, sendJson } = require("../_lib/service");

module.exports = async (req, res) => {
  if (applyCors(req, res)) {
    return;
  }

  try {
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const items = await listAttendance(supabase, {
        location: String(req.query.location || "").trim(),
        name: String(req.query.name || "").trim(),
        employeeId: String(req.query.employeeId || "").trim()
      });
      sendJson(res, 200, { items });
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const item = await saveAttendanceRecord(supabase, body);
      sendJson(res, 201, { item });
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unable to process attendance request." });
  }
};
