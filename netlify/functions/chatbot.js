// netlify/functions/chatbot.js
import fetch from "node-fetch"; // Remove if using Node 18+
import Database from "better-sqlite3";
import path from "path";

export async function handler(event) {
  try {
    const { message } = JSON.parse(event.body);

    // ----------------------------
    // 1. Connect to SQLite database
    // ----------------------------
    const dbPath = path.resolve("data/photos.db"); // adjust if stored elsewhere
    const db = new Database(dbPath);

    // ----------------------------
    // 2. Search DB for matching tags
    // ----------------------------
    const stmt = db.prepare("SELECT * FROM photos WHERE tags LIKE ?");
    const rows = stmt.all(`%${message.toLowerCase()}%`);

    // ----------------------------
    // 3. AI system prompt
    // ----------------------------
    const systemPrompt = `
    You are BazzBot 📸, a photography assistant.
    - Only answer questions related to photography, cameras, techniques, or Bazz's portfolio.
    - If asked non-photography questions, politely decline.
    - Always reply in concise "DeepSeek" style.
    - If relevant images are found in the database, include them as <img> thumbnails with captions.
    `;

    // ----------------------------
    // 4. Ask AI for a textual reply
    // ----------------------------
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();
    let reply = aiData.choices?.[0]?.message?.content || "⚠️ I couldn’t generate a reply.";

    // ----------------------------
    // 5. Append DB results as thumbnails
    // ----------------------------
    if (rows.length > 0) {
      reply += "\n\nHere are some photos:\n";
      rows.forEach(photo => {
        reply += `<img src="${photo.link}" alt="${photo.caption}" class="chat-thumbnail" />`;
        reply += `<p>${photo.caption}</p>`;
      });
    }

    db.close();

    return {
      statusCode: 200,
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    console.error("Error in chatbot.js:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ reply: "⚠️ Something went wrong." })
    };
  }
}
