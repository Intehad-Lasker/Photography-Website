const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const { message } = JSON.parse(event.body);

    // --- Call OpenRouter API ---
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
            content: "You are BazzBot, a helpful photography assistant."
          },
          { role: "user", content: message }
        ]
      })
    });

    // If request failed, log details
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ OpenRouter API error:", response.status, errorText);
      return {
        statusCode: response.status,
        body: JSON.stringify({ reply: "⚠️ OpenRouter API error. Check logs." })
      };
    }

    const data = await response.json();
    console.log("✅ OpenRouter API response:", data);

    const reply = data?.choices?.[0]?.message?.content || "⚠️ No reply from AI.";

    return {
      statusCode: 200,
      body: JSON.stringify({ reply })
    };
  } catch (error) {
    console.error("❌ Chatbot function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ reply: "⚠️ Server error. Please try again later." })
    };
  }
};
