import { Hono } from "hono";
import { cors } from "hono/cors";
import { handleFormSubmission } from "./handlers/form";
import { registerUser, loginUser, verifyToken } from "./handlers/auth";
import { handleWebSocketUpgrade, broadcastNewPost } from "./websocket";
import { WebSocketRoom } from "./durable-objects/WebSocketRoom";

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use("*", cors({
	origin: (origin, c) => {
		const allowed = c.env.ALLOWED_ORIGINS || "*";
		if (allowed === "*") return "*";
		const origins = allowed.split(",").map((o: string) => o.trim());
		if (!origin || origins.includes(origin)) return origin;
		return origins[0];
	},
	allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
	allowHeaders: ["Content-Type", "Authorization"],
	exposeHeaders: ["Content-Length"],
	maxAge: 86400,
	credentials: true,
}));

// Auth middleware using D1
const requireAuth = async (c: any, next: any) => {
	const authHeader = c.req.header("Authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const token = authHeader.substring(7);
	
	try {
		const decoded = atob(token);
		const [userId] = decoded.split(":");

		// Verify user exists in database
		const user = await c.env.DB.prepare(
			"SELECT id, username FROM users WHERE id = ?"
		).bind(parseInt(userId)).first();

		if (!user) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		// Attach user to context
		c.user = user;
		await next();
	} catch (error) {
		return c.json({ error: "Unauthorized" }, 401);
	}
};

// Authentication routes
app.post("/api/register", async (c) => {
	return await registerUser(c);
});

app.post("/api/login", async (c) => {
	return await loginUser(c);
});

app.get("/api/verify", requireAuth, async (c) => {
	return await verifyToken(c);
});

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

// WebSocket endpoint
app.get("/ws", async (c) => {
	const upgradeHeader = c.req.header("Upgrade");
	if (upgradeHeader === "websocket") {
		const response = await handleWebSocketUpgrade(c.req.raw, c.env);
		return response;
	}
	return c.text("WebSocket upgrade required", 426);
});

// Form submission endpoint
app.post("/api/submit", async (c) => {
	try {
		const result = await handleFormSubmission(c);
		
		// If submission was successful, broadcast to WebSocket clients
		if (result.status === 200) {
			try {
				// Get submission from the response (attached in handleFormSubmission)
				const submission = (result as any).submission;
				console.log("Form submission successful, submission attached:", submission);
				if (submission) {
					console.log("Broadcasting submission:", submission);
					await broadcastNewPost(submission, c.env);
				} else {
					console.log("No submission attached to response");
				}
			} catch (error) {
				console.error("Error broadcasting new post:", error);
				// Don't fail the request if broadcasting fails
			}
		} else {
			console.log("Form submission failed, status:", result.status);
		}
		
		return result;
	} catch (error) {
		console.error("Form submission error:", error);
		return c.json(
			{ error: "Internal server error", message: (error as Error).message },
			500
		);
	}
});

// List all submissions (admin only)
app.get("/api/submissions", requireAuth, async (c) => {
	try {
		const kv = c.env.FORM_SUBMISSIONS;
		const list = await kv.list();
		
		const submissions = await Promise.all(
			list.keys.map(async (key) => {
				const value = await kv.get(key.name);
				if (value) {
					return {
						id: key.name.replace("submission:", ""),
						...JSON.parse(value),
					};
				}
				return null;
			})
		);

		return c.json({
			success: true,
			count: submissions.filter(s => s !== null).length,
			submissions: submissions.filter(s => s !== null),
		});
	} catch (error) {
		console.error("List submissions error:", error);
		return c.json(
			{ error: "Internal server error", message: (error as Error).message },
			500
		);
	}
});

// Delete submission (admin only)
app.delete("/api/submissions/:id", requireAuth, async (c) => {
	try {
		const id = c.req.param("id");
		const kv = c.env.FORM_SUBMISSIONS;
		
		// Get submission to find file info
		const submissionData = await kv.get(`submission:${id}`);
		if (!submissionData) {
			return c.json({ error: "Submission not found" }, 404);
		}

		// Delete from KV
		await kv.delete(`submission:${id}`);

		return c.json({ success: true, message: "Submission deleted" });
	} catch (error) {
		console.error("Delete submission error:", error);
		return c.json(
			{ error: "Internal server error", message: (error as Error).message },
			500
		);
	}
});

// Export Durable Object class for Cloudflare Workers
export { WebSocketRoom };

export default app;
