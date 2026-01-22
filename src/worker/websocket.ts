// WebSocket connection manager using Durable Objects
// This allows WebSockets to be accessed across different request contexts

// Handle WebSocket upgrade using Durable Object
export async function handleWebSocketUpgrade(request: Request, env: any): Promise<Response> {
	const upgradeHeader = request.headers.get("Upgrade");
	if (upgradeHeader !== "websocket") {
		return new Response("Expected Upgrade: websocket", { status: 426 });
	}

	// Get or create Durable Object instance
	// Use a single ID for all connections (or you could use user-specific IDs)
	const id = env.WEBSOCKET_ROOM.idFromName("main-room");
	const stub = env.WEBSOCKET_ROOM.get(id);

	// Forward the WebSocket upgrade request to the Durable Object
	return stub.fetch(request);
}

// Broadcast new post using Durable Object
export async function broadcastNewPost(submission: any, env: any): Promise<void> {
	try {
		// Get the same Durable Object instance
		const id = env.WEBSOCKET_ROOM.idFromName("main-room");
		const stub = env.WEBSOCKET_ROOM.get(id);

		// Send broadcast request to Durable Object
		const response = await stub.fetch("http://fake-host/broadcast", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(submission),
		});

		const result = await response.json();
		console.log(`Broadcast result:`, result);
	} catch (error) {
		console.error("Error broadcasting via Durable Object:", error);
	}
}
