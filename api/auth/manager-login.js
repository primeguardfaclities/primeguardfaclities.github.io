const { applyCors, findUserByCredentials, getSupabaseAdmin, readBody, sendJson } = require("../_lib/service");

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
    const user = await findUserByCredentials(supabase, username, password, "manager");

    if (!user) {
      sendJson(res, 401, { error: "Invalid manager credentials." });
      return;
    }

    sendJson(res, 200, { user });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unable to complete manager login." });
  }
};
