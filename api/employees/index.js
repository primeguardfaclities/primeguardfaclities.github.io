const { applyCors, getSupabaseAdmin, listUsers, readBody, saveUserRecord, sendJson } = require("../_lib/service");

module.exports = async (req, res) => {
  if (applyCors(req, res)) {
    return;
  }

  try {
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const items = await listUsers(supabase);
      sendJson(res, 200, { items });
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const item = await saveUserRecord(supabase, body);
      sendJson(res, 201, { item });
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unable to process employees request." });
  }
};
