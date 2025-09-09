// netlify/functions/chatbot.js
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";

export async function handler(event) {
  try {
    const { message } = JSON.parse(event.body);

    // 1. Resolve DB path
    const dbPath = path.join(__dirname, "../data/photos.db");
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // 2. Query DB
    const rows = await db.all(
      "SELECT * FROM photos WHERE tags LIKE ?",
      [`%${message.toLowerCase()}%`]
    );

    console.log("DB results:", rows);

    // 3. System prompt
    const systemPrompt = `
    You are BazzBot 📸, a photography assistant.
    - Your MAIN objective is to show relevant photos from Bazz's database.
    - For every user request:
      1. Retrieve matching photos from the DB.
      2. Present them as: thumbnail + cleaned caption + green "Download" button.
    - Clean and rewrite captions to be short, clear, and photography-friendly.
    - Only add text commentary if helpful, but photos are ALWAYS the main output.
    - Do NOT generate your own <img> tags or Markdown images.
    - Answer photopgraphy related questions if asked
    `;

    // 4. Call DeepSeek for text response
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

      // 🚫 Strip any rogue <img> or markdown from DeepSeek
      reply = reply.replace(/!\[.*?\]\(.*?\)/g, "");
      reply = reply.replace(/<img[^>]*>/g, "");
    } else {
      reply = "⚠️ I couldn’t generate a reply";
    }

    // 5. Append DB results (with thumbnails + modal support + download button)
    if (rows.length > 0) {
      reply += "\n\nHere are some photos:\n";
      rows.forEach((photo) => {
        let url = photo.link || `/images/${photo.filename}`;
        let caption = photo.caption || photo.tags || photo.filename || "Untitled photo";

        // Convert Google Drive link → direct image
        if (url.includes("drive.google.com/file/d/")) {
          const match = url.match(/\/d\/([^/]+)\//);
          if (match && match[1]) {
            url = `https://drive.google.com/uc?export=view&id=${match[1]}`;
          }
        }

        // ✅ Structured preview + download button
        reply += `
          <div class="photo-block">
            <img 
              src="${url}" 
              alt="${caption}" 
              class="chat-thumbnail"
              data-full="${url}"
              data-caption="${caption}"
            />
            <p>${caption}</p>
            <a href="${url}" download class="download-btn">⬇ Download</a>
          </div>
        `;
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
