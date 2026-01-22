import { Hono } from "hono";
const app = new Hono<{ Bindings: Env }>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));

app.get("/env", (c) => {
    const envData = c.env.ENV_DATA;
    console.log('Here')
    return c.text(envData);
});

app.post("/post/", async (c) => {
    const body = await c.req.json();
    console.log(body);
    return c.json({ status: "ok" });
});

// Route to check if the key exists in KV
app.post("/check-key", async (c) => {
    // Get the key from the request body
    const { key } = await c.req.json();
    
    // Check if the key exists in the KV store
    const value = await c.env.USER_COLORS.get(key);
  
    if (value) {
      // If the key exists, return the value
      return c.json({ status: "ok", value });
    } else {
      // If the key doesn't exist, return an error message
      return c.json({ status: "error", message: "Invalid key" });
    }
});

// Route to handle poem generation using AI model
app.post("/generate-poem", async (c) => {
    const { inputText } = await c.req.json();
  
    // Ensure the input is within the allowed length (up to 50 characters)
    if (inputText.length > 50) {
      return c.json({ status: "error", message: "Input must be 50 characters or fewer." });
    }
  
    // Prompt for the AI model, including instructions for work-appropriate and safe responses
    const prompt = `Write a work-appropriate poem about: ${inputText}. Avoid offensive language or any inappropriate content.`;
  
    try {
      // Call the AI model to generate the poem
      const aiResponse = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {prompt}, {stream: false});
  
      return c.json({ status: "ok", poem: aiResponse.response });
    } catch (err) {
      return c.json({ status: "error", message: "Failed to generate poem. Please try again." + (err as Error).message });
    }
  });

export default app;
