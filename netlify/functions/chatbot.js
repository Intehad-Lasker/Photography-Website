// netlify/functions/chatbot.js
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";

export async function handler(event) {
  try {
    const { message } = JSON.parse(event.body);

    // ----------------------------
    // 1. Resolve DB path
    // ----------------------------
    const dbPath = path.join(__dirname, "../data/photos.db");
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // ----------------------------
    // 2. Query DB for matches
    // ----------------------------
    const rows = await db.all(
      "SELECT * FROM photos WHERE tags LIKE ?",
      [`%${message.toLowerCase()}%`]
    );

    console.log("DB results:", rows);

    // ----------------------------
    // 3. System prompt
    // ----------------------------
    const systemPrompt = `
    You are BazzBot 📸, a photography assistant.
    - Only answer questions related to photography, cameras, techniques, or Bazz's portfolio.
    - If asked non-photography questions, politely decline.
    - Always reply in concise "DeepSeek" style.
    - If relevant images are found in the database, include them as <img> thumbnails with captions.
    `;

    // ----------------------------
    // 4. Call DeepSeek via OpenRouter
    // ----------------------------
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    const aiData = await aiResponse.json();
    console.log("AI raw response:", JSON.stringify(aiData, null, 2));

    let reply;
    if (aiData.choices && aiData.choices[0]?.message?.content) {
      reply = aiData.choices[0].message.content;
    } else {
      reply = "⚠️ I couldn’t generate a reply from DeepSeek.";
    }

    // ----------------------------
    // 5. Append DB results
    // ----------------------------
    if (rows.length > 0) {
      reply += "\n\nHere are some photos:\n";
      rows.forEach((photo) => {
        const url = photo.link || `/images/${photo.filename}`;
        const caption = photo.caption || photo.tags || photo.filename || "Untitled photo";

        reply += `<img src="${url}" alt="${caption}" class="chat-thumbnail" />`;
        reply += `<p>${caption}</p>`;
      });
    }

    await db.close();

    return {
      statusCode: 200,
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    console.error("Error in chatbot.js:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ reply: "⚠️ Something went wrong." }),
    };
  }
}
