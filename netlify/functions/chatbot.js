const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { message } = JSON.parse(event.body);
  const userMessage = message.toLowerCase();

  try {
    // --- 1. Extract keywords for photo search ---
    const searchKeywords = userMessage
      .split(" ")
      .filter((w) => w.length > 2); // filter out "a", "is", "to", etc.

    let photoResults = [];

    if (searchKeywords.length > 0) {
      const dbPath = path.resolve("photos.db");
      const db = new sqlite3.Database(dbPath);

      // Build WHERE clause dynamically
      const whereClause = searchKeywords
        .map((kw) => `(tags LIKE '%${kw}%' OR caption LIKE '%${kw}%')`)
        .join(" AND ");

      const query = `SELECT filename, tags, caption, link 
                     FROM photos 
                     WHERE ${whereClause} 
                     LIMIT 5`;

      photoResults = await new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      db.close();
    }

    // --- 2. If photos are found, return them ---
    if (photoResults.length > 0) {
      const reply = photoResults
        .map(
          (r) =>
            `📸 <b>${r.caption}</b><br><a href="${r.link}" target="_blank">View Photo</a>`
        )
        .join("<br><br>");

      return {
        statusCode: 200,
        body: JSON.stringify({ reply }),
      };
    }

    // --- 3. Otherwise, fallback to AI chatbot ---
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-r1",
          messages: [
            {
              role: "system",
              content:
                "You are BazzBot, a helpful photography assistant. Keep answers short, clear, and user-friendly.",
            },
            { role: "user", content: message },
          ],
        }),
      }
    );

    const data = await response.json();

    console.log("🔍 OpenRouter API Response:", JSON.stringify(data, null, 2));

    const reply =
      data?.choices?.[0]?.message?.content ||
      "⚠️ Sorry, I couldn’t generate a reply.";

    return {
      statusCode: 200,
      body: JSON.stringify({ reply }),
    };
  } catch (error) {
    console.error("Chatbot error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        reply: "⚠️ Server error. Please try again later.",
      }),
    };
  }
};
