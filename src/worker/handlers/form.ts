import { Context } from "hono";

interface FormHandlerEnv {
	FORM_SUBMISSIONS: any; // KVNamespace
	AI: any; // Ai
	ADMIN_EMAIL: string;
	RESEND_API_KEY: string;
	WEBHOOK_URL?: string;
}

interface FormSubmission {
	name: string;
	email: string;
	message: string;
	timestamp: string;
	id: string;
}

// Check spam using Workers AI and keyword detection
async function checkSpam(message: string, ai: any): Promise<boolean> {
	try {
		// Check message length (very short messages might be spam)
		if (message.trim().length < 10) {
			return true;
		}

		// Use Workers AI for sentiment analysis
		try {
			const aiResponse = await ai.run(
				"@cf/huggingface/distilbert-sst-2-int8",
				{
					text: message.substring(0, 512), // Limit to 512 chars for model
				}
			);

			// The model returns an array with scores for negative/positive
			// If negative score is high, it might be spam
			if (Array.isArray(aiResponse) && aiResponse.length > 0) {
				const result = aiResponse[0];
				// Check if it's classified as negative with high confidence
				if (result.label === "NEGATIVE" && result.score > 0.7) {
					return true;
				}
			}
		} catch (aiError) {
			// If AI check fails, continue with other checks
			console.error("AI spam check error:", aiError);
		}

		return false;
	} catch (error) {
		console.error("Spam check error:", error);
		// If spam check fails, allow submission but log
		return false;
	}
}

// Validate email format
function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

// Send email notification via Resend
async function sendEmail(
	submission: FormSubmission,
	env: FormHandlerEnv
): Promise<void> {
	try {
		if (!env.RESEND_API_KEY) {
			console.warn("RESEND_API_KEY not set, skipping email");
			return;
		}

		const emailHtml = `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background: #2563eb; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
					.content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
					.field { margin-bottom: 15px; }
					.label { font-weight: bold; color: #4b5563; }
					.value { margin-top: 5px; color: #111827; }
					.file-info { background: #e0e7ff; padding: 10px; border-radius: 5px; margin-top: 10px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h2>New Form Submission</h2>
					</div>
					<div class="content">
						<div class="field">
							<div class="label">Name:</div>
							<div class="value">${escapeHtml(submission.name)}</div>
						</div>
						<div class="field">
							<div class="label">Email:</div>
							<div class="value">${escapeHtml(submission.email)}</div>
						</div>
						<div class="field">
							<div class="label">Message:</div>
							<div class="value">${escapeHtml(submission.message)}</div>
						</div>
						<div class="field">
							<div class="label">Submitted:</div>
							<div class="value">${new Date(submission.timestamp).toLocaleString()}</div>
						</div>
						<div class="field">
							<div class="label">Submission ID:</div>
							<div class="value">${submission.id}</div>
						</div>
					</div>
				</div>
			</body>
			</html>
		`;

		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.RESEND_API_KEY}`,
			},
			body: JSON.stringify({
				from: "Form Handler <noreply@example.com>",
				to: [env.ADMIN_EMAIL],
				subject: `New Form Submission from ${submission.name}`,
				html: emailHtml,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Resend API error: ${response.status} - ${errorText}`);
		}
	} catch (error) {
		console.error("Email send error:", error);
		// Don't throw - email failure shouldn't block submission
	}
}

// Send webhook notification
async function sendWebhook(
	submission: FormSubmission,
	env: FormHandlerEnv
): Promise<void> {
	try {
		if (!env.WEBHOOK_URL) {
			return; // Webhook is optional
		}

		const payload = {
			text: `New Form Submission`,
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: `*New Form Submission*\n\n*Name:* ${submission.name}\n*Email:* ${submission.email}\n*Message:* ${submission.message.substring(0, 200)}${submission.message.length > 200 ? "..." : ""}\n*Submitted:* ${new Date(submission.timestamp).toLocaleString()}`,
					},
				},
			],
		};

		const response = await fetch(env.WEBHOOK_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			throw new Error(`Webhook error: ${response.status}`);
		}
	} catch (error) {
		console.error("Webhook send error:", error);
		// Don't throw - webhook failure shouldn't block submission
	}
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
	const map: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#039;",
	};
	return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Main form submission handler
export async function handleFormSubmission(c: Context<{ Bindings: any }>) {
	const formData = await c.req.formData();

	// Extract form fields
	const name = formData.get("name")?.toString().trim() || "";
	const email = formData.get("email")?.toString().trim() || "";
	const message = formData.get("message")?.toString().trim() || "";

	// Validate required fields
	if (!name || name.length < 2) {
		return c.json({ error: "Name is required and must be at least 2 characters" }, 400);
	}

	if (!email || !isValidEmail(email)) {
		return c.json({ error: "Valid email is required" }, 400);
	}

	if (!message || message.length < 10) {
		return c.json({ error: "Message is required and must be at least 10 characters" }, 400);
	}

	// Check for spam
	const isSpam = await checkSpam(message, c.env.AI);
	if (isSpam) {
		return c.json({ error: "Submission rejected as spam" }, 403);
	}

	// Generate submission ID and timestamp
	const id = crypto.randomUUID();
	const timestamp = new Date().toISOString();

	// Create submission object
	const submission: FormSubmission = {
		id,
		name,
		email,
		message,
		timestamp,
	};

	// Save to KV with 30 day TTL
	const kvKey = `submission:${id}`;
	const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
	await c.env.FORM_SUBMISSIONS.put(kvKey, JSON.stringify(submission), {
		expirationTtl: ttl,
	});

	// Send notifications (don't block on failures)
	await Promise.allSettled([
		sendEmail(submission, c.env as FormHandlerEnv),
		sendWebhook(submission, c.env as FormHandlerEnv),
	]);

	// Return both the response and submission data for WebSocket broadcasting
	const response = c.json({
		success: true,
		id,
		message: "Form submitted successfully",
	});
	
	// Attach submission to response for broadcasting
	(response as any).submission = submission;
	
	return response;
}
