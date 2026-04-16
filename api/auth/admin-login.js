const { ADMIN_PASSWORD, ADMIN_USERNAME, applyCors, readBody, sendJson } = require("../_lib/service");

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

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      sendJson(res, 401, { error: "Invalid admin credentials." });
      return;
    }

    sendJson(res, 200, { success: true });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unable to complete admin login." });
  }
};
