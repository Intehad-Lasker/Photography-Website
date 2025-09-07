const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { message } = JSON.parse(event.body);

  try {
    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` // 🔑 your API key in Netlify
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are BazzBot, a helpful photography assistant. Suggest images from the gallery when asked." },
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
      body: JSON.stringify({ reply: "⚠️ Error connecting to AI: " + error.message })
    };
  }
};
