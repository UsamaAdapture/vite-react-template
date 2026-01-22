import { Context } from "hono";

// Hash password using Web Crypto API
async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(password);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Register a new user
export async function registerUser(c: Context<{ Bindings: any }>) {
	try {
		const { username, password } = await c.req.json();

		// Validate input
		if (!username || username.length < 3) {
			return c.json({ error: "Username must be at least 3 characters" }, 400);
		}

		if (!password || password.length < 6) {
			return c.json({ error: "Password must be at least 6 characters" }, 400);
		}

		// Check if user already exists
		const existingUser = await c.env.DB.prepare(
			"SELECT id FROM users WHERE username = ?"
		).bind(username).first();

		if (existingUser) {
			return c.json({ error: "Username already exists" }, 409);
		}

		// Hash password
		const passwordHash = await hashPassword(password);

		// Insert user
		const result = await c.env.DB.prepare(
			"INSERT INTO users (username, password_hash) VALUES (?, ?)"
		).bind(username, passwordHash).run();

		if (result.success) {
			return c.json({
				success: true,
				message: "User registered successfully",
				userId: result.meta.last_row_id,
			});
		} else {
			return c.json({ error: "Failed to register user" }, 500);
		}
	} catch (error) {
		console.error("Registration error:", error);
		return c.json(
			{ error: "Internal server error", message: (error as Error).message },
			500
		);
	}
}

// Login user
export async function loginUser(c: Context<{ Bindings: any }>) {
	try {
		const { username, password } = await c.req.json();

		// Validate input
		if (!username || !password) {
			return c.json({ error: "Username and password are required" }, 400);
		}

		// Find user
		const userResult = await c.env.DB.prepare(
			"SELECT id, username, password_hash FROM users WHERE username = ?"
		).bind(username).first();

		if (!userResult) {
			return c.json({ error: "Invalid username or password" }, 401);
		}
		const user = {
			id: userResult.id as number,
			username: userResult.username as string,
			password_hash: userResult.password_hash as string,
		};


		// Verify password
		const passwordHash = await hashPassword(password);
		if (passwordHash !== user.password_hash) {
			return c.json({ error: "Invalid username or password" }, 401);
		}

		// Generate a simple token (in production, use JWT or similar)
		const token = btoa(`${user.id}:${user.username}:${Date.now()}`);

		return c.json({
			success: true,
			token,
			user: {
				id: user.id,
				username: user.username,
			},
		});
	} catch (error) {
		console.error("Login error:", error);
		return c.json(
			{ error: "Internal server error", message: (error as Error).message },
			500
		);
	}
}

// Verify token and get user info
export async function verifyToken(c: Context<{ Bindings: any }>) {
	try {
		const authHeader = c.req.header("Authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		const token = authHeader.substring(7);
		const decoded = atob(token);
		const [userId] = decoded.split(":");

		// Get user from database
		const user = await c.env.DB.prepare(
			"SELECT id, username FROM users WHERE id = ?"
		).bind(Number(userId)).first();

		if (!user) {
			return c.json({ error: "Invalid token" }, 401);
		}


		return c.json({
			success: true,
			user: {
				id: user.id,
				username: user.username,
			},
		});
	} catch (error) {
		console.error("Token verification error:", error);
		return c.json({ error: "Invalid token" }, 401);
	}
}
