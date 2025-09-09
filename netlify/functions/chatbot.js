// netlify/functions/chatbot.js
import fetch from "node-fetch"; // Needed if you're on Node < 18. Remove if using Netlify Node 18+ runtime.

export async function handler(event) {
  try {
    const { message } = JSON.parse(event.body);

    // ----------------------------
    // 1. Define system prompt (bot personality)
    // ----------------------------
    const systemPrompt = `
    You are BazzBot 📸, a photography assistant.
    - Only answer questions related to photography, cameras, techniques, or Bazz's portfolio.
    - You help users find photos by tags (sunset, portrait, city, etc.).
    - If asked non-photography questions, politely decline and remind them you're only a photography bot.
    - Always reply in a sharp, concise "DeepSeek" style, like an insightful guide.
    - When images are relevant, return them as <img> thumbnails with captions.
    `;

    // ----------------------------
    // 2. Example tagged photo database
    // ----------------------------
    const photoDB = [
      { tag: "sunset", url: "/images/sunset1.jpg", caption: "Sunset over the hills" },
      { tag: "sunset", url: "/images/sunset2.jpg", caption: "Golden sunset at the beach" },
      { tag: "city", url: "/images/city1.jpg", caption: "Downtown skyline" },
      { tag: "portrait", url: "/images/portrait1.jpg", caption: "Black and white portrait" }
    ];

    // Simple tag search
    function searchImages(query) {
      const lower = query.toLowerCase();
      return photoDB.filter(p => lower.includes(p.tag));
    }

    // ----------------------------
    // 3. AI response (OpenAI example)
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
    let reply = aiData.choices?.[0]?.message?.content || "⚠️ Sorry, I couldn't generate a reply.";

    // ----------------------------
    // 4. If query matches tags, append thumbnails
    // ----------------------------
    const matches = searchImages(message);
    if (matches.length > 0) {
      reply += "\n\nHere are some photos:\n";
      matches.forEach(m => {
        reply += `<img src="${m.url}" alt="${m.caption}" class="chat-thumbnail" />`;
        reply += `<p>${m.caption}</p>`;
      });
    }

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
