exports.handler = async (event) => {
  const { message } = JSON.parse(event.body);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1",
        messages: [
          { role: "system", content: "You are BazzBot, a helpful photography assistant." },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();

    if (!data.choices || !data.choices[0]?.message?.content) {
      throw new Error("Invalid API response: " + JSON.stringify(data));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ reply: data.choices[0].message.content })
    };

  } catch (error) {
    console.error("Chatbot error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ reply: "⚠️ Error: " + error.message })
    };
  }
};
