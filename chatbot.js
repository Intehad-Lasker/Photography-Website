exports.handler = async (event) => {
  const { message } = JSON.parse(event.body);

  try {
    // Call DeepSeek R1 via OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` // must be set in Netlify
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1",
        messages: [
          {
            role: "system",
            content: "You are BazzBot, a helpful photography assistant. Keep answers short, clear, and user-friendly."
          },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();

    // ✅ Ensure reply always exists
    const reply =
      data?.choices?.[0]?.message?.content ||
      "⚠️ Sorry, I couldn’t generate a reply.";

    return {
      statusCode: 200,
      body: JSON.stringify({ reply })
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
