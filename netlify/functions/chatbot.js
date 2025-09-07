const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { message } = JSON.parse(event.body);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` // Secure API key
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // lightweight GPT model
        messages: [
          { role: "system", content: "You are BazzBot, a photography assistant. Help users find photos by tags like car, bike, sunset, etc." },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();
    const reply = data.choices[0].message.content;

    return {
      statusCode: 200,
      body: JSON.stringify({ reply })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ reply: "⚠️ Error: " + error.message })
    };
  }
};
