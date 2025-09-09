const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { message } = JSON.parse(event.body);

  try {
    // --- Step 1: Call DeepSeek for interpretation ---
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1",
        messages: [
          {
            role: "system",
            content:
              "You are BazzBot, a helpful photography assistant. " +
              "If the user asks for photos, identify keywords (like sunset, beach, car, etc.) " +
              "and clearly say: 'PHOTO_SEARCH: keyword1, keyword2'. Otherwise, reply normally."
          },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();
    const aiReply =
      data?.choices?.[0]?.message?.content || "⚠️ No reply from AI.";

    // --- Step 2: Check if AI requested photos ---
    let photoResults = [];
    if (aiReply.includes("PHOTO_SEARCH:")) {
      const keywords = aiReply
        .split("PHOTO_SEARCH:")[1]
        .trim()
        .split(",")
        .map((k) => k.trim());

      const dbPath = path.resolve(__dirname, "../data/photos.db"); // ✅ match repo path
      const db = new sqlite3.Database(dbPath);

      const whereClause = keywords
        .map((kw) => `(tags LIKE '%${kw}%' OR caption LIKE '%${kw}%')`)
        .join(" AND ");

      const query = `SELECT filename, tags, caption, link FROM photos WHERE ${whereClause} LIMIT 5`;

      photoResults = await new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      db.close();
    }

    // --- Step 3: Build final reply ---
    let finalReply = aiReply;
    if (photoResults.length > 0) {
      finalReply +=
        "<br><br>" +
        photoResults
          .map(
            (r) =>
              `📸 ${r.caption}<br><a href="${r.link}" target="_blank">View Photo</a>`
          )
          .join("<br><br>");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ reply: finalReply })
    };
  } catch (error) {
    console.error("Chatbot error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        reply: "⚠️ Server error. Please try again later."
      })
    };
  }
};
