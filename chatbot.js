const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { message } = JSON.parse(event.body);
  const userMessage = message.toLowerCase();

  try {
    // --- 1. Search photos from DB ---
    const searchKeywords = userMessage.split(" ").filter((w) => w.length > 2);

    let photoResults = [];
    if (searchKeywords.length > 0) {
      const dbPath = path.resolve("photos.db");
      const db = new sqlite3.Database(dbPath);

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

    // --- 2. Build extra context for DeepSeek ---
    let photoContext = "";
    if (photoResults.length > 0) {
      const formatted = photoResults
        .map((r) => `• ${r.caption} 👉 ${r.link}`)
        .join("\n");
      photoContext = `\nThe following matching photos were found in the database:\n${formatted}`;
    }

    // --- 3. Always call DeepSeek ---
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
              "You are BazzBot, a photography assistant. Answer naturally, " +
              "and if photo results are provided, include them in your reply.",
          },
          {
            role: "user",
            content: `${message}${photoContext}`,
          },
        ],
      }),
    });

    const data = await response.json();
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
