// Durable Object for managing WebSocket connections
// This allows WebSockets to be accessed across different request contexts

export class WebSocketRoom {
	state: DurableObjectState;
	env: any;
	sessions: Map<string, WebSocket>;

	constructor(state: DurableObjectState, env: any) {
		this.state = state;
		this.env = env;
		this.sessions = new Map();
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// Handle WebSocket upgrade
		if (request.headers.get("Upgrade") === "websocket") {
			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);

			// Accept the WebSocket connection
			server.accept();

			// Generate connection ID
			const connectionId = crypto.randomUUID();
			this.sessions.set(connectionId, server);

			console.log(`WebSocket connection established in Durable Object: ${connectionId}, total: ${this.sessions.size}`);

			// Handle messages
			server.addEventListener("message", (event) => {
				try {
					const data = JSON.parse(event.data as string);
					if (data.type === "auth" && data.token) {
						try {
							const decoded = atob(data.token);
							const [userId] = decoded.split(":");
							console.log(`Authenticated connection ${connectionId} for user ${userId}`);
						} catch (error) {
							console.error("WebSocket auth error:", error);
						}
					}
				} catch (error) {
					console.error("WebSocket message error:", error);
				}
			});

			// Handle close
			server.addEventListener("close", () => {
				console.log(`WebSocket connection closed: ${connectionId}`);
				this.sessions.delete(connectionId);
			});

			// Handle error
			server.addEventListener("error", (error) => {
				console.error(`WebSocket error on ${connectionId}:`, error);
				this.sessions.delete(connectionId);
			});

			return new Response(null, {
				status: 101,
				webSocket: client,
			});
		}

		// Handle broadcast request
		if (url.pathname === "/broadcast" && request.method === "POST") {
			const submission = await request.json();
			return this.broadcast(submission);
		}

		return new Response("Not found", { status: 404 });
	}

	broadcast(submission: any): Response {
		const message = JSON.stringify({
			type: "new_post",
			post: submission,
		});

		let broadcastCount = 0;
		for (const [connectionId, ws] of this.sessions.entries()) {
			try {
				if (ws.readyState === WebSocket.READY_STATE_OPEN) {
					ws.send(message);
					broadcastCount++;
					console.log(`Sent message to connection ${connectionId}`);
				} else {
					// Remove closed connections
					this.sessions.delete(connectionId);
				}
			} catch (error) {
				console.error(`Error broadcasting to connection ${connectionId}:`, error);
				this.sessions.delete(connectionId);
			}
		}

		console.log(`Broadcasted new post to ${broadcastCount} connected clients`);
		return new Response(JSON.stringify({ success: true, broadcastCount }), {
			headers: { "Content-Type": "application/json" },
		});
	}
}
