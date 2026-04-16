const { applyCors, deleteAttendanceRecord, getSupabaseAdmin, readBody, saveAttendanceRecord, sendJson } = require("../../_lib/service");

module.exports = async (req, res) => {
  if (applyCors(req, res)) {
    return;
  }

  const employeeId = String(req.query.employeeId || "").trim();
  const date = String(req.query.date || "").trim();

  if (!employeeId || !date) {
    sendJson(res, 400, { error: "Employee ID and date are required." });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();

    if (req.method === "PUT") {
      const body = await readBody(req);
      const item = await saveAttendanceRecord(supabase, body, employeeId, date);
      sendJson(res, 200, { item });
      return;
    }

    if (req.method === "DELETE") {
      await deleteAttendanceRecord(supabase, employeeId, date);
      sendJson(res, 200, { success: true });
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unable to process attendance item request." });
  }
};
