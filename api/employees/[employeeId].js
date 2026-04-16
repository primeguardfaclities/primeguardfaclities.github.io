const { applyCors, deleteUserRecord, getSupabaseAdmin, readBody, saveUserRecord, sendJson } = require("../_lib/service");

module.exports = async (req, res) => {
  if (applyCors(req, res)) {
    return;
  }

  const employeeId = String(req.query.employeeId || "").trim();
  if (!employeeId) {
    sendJson(res, 400, { error: "Employee ID is required." });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();

    if (req.method === "PUT") {
      const body = await readBody(req);
      const item = await saveUserRecord(supabase, body, employeeId);
      sendJson(res, 200, { item });
      return;
    }

    if (req.method === "DELETE") {
      await deleteUserRecord(supabase, employeeId);
      sendJson(res, 200, { success: true });
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unable to process employee request." });
  }
};
