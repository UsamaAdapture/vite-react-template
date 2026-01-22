// src/App.tsx

import { useState, useEffect } from "react";
import "./App.css";

function App() {
	// Auth state
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [user, setUser] = useState<{ id: number; username: string } | null>(null);
	const [authMode, setAuthMode] = useState<"login" | "register">("login");
	const [authData, setAuthData] = useState({ username: "", password: "" });
	const [authLoading, setAuthLoading] = useState(false);
	const [authError, setAuthError] = useState("");

	// Feed state
	const [submissions, setSubmissions] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const [token, setToken] = useState<string | null>(localStorage.getItem("token"));

	// Form submission state
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		message: "",
	});
	const [formLoading, setFormLoading] = useState(false);
	const [formStatus, setFormStatus] = useState<{ type: string; message: string } | null>(null);

	// Check if user is authenticated on mount
	useEffect(() => {
		if (token) {
			verifyAuth();
		}
	}, []);

	// WebSocket connection
	useEffect(() => {
		if (!isAuthenticated || !token) return;

		// Connect to WebSocket
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const wsUrl = `${protocol}//${window.location.host}/ws`;
		const ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			console.log("WebSocket connected");
			// Send authentication token
			ws.send(JSON.stringify({ type: "auth", token }));
		};

		ws.onmessage = (event) => {
			try {
				console.log("WebSocket message received:", event.data);
				const data = JSON.parse(event.data);
				console.log("Parsed WebSocket data:", data);
				if (data.type === "new_post") {
					console.log("New post received via WebSocket:", data.post);
					// Append new post at the end (bottom) of the feed
					setSubmissions((prev) => {
						// Check if post already exists (avoid duplicates)
						const exists = prev.some((p) => p.id === data.post.id);
						if (exists) {
							console.log("Post already exists, skipping");
							return prev;
						}
						
						console.log("Adding new post to feed");
						// Append at the end (oldest first, so new ones go to bottom)
						return [...prev, data.post];
					});
				}
			} catch (error) {
				console.error("WebSocket message error:", error);
			}
		};

		ws.onerror = (error) => {
			console.error("WebSocket error:", error);
		};

		ws.onclose = () => {
			console.log("WebSocket disconnected");
			// Attempt to reconnect after 3 seconds
			setTimeout(() => {
				if (isAuthenticated && token) {
					// Reconnect will be handled by useEffect
				}
			}, 3000);
		};

		return () => {
			ws.close();
		};
	}, [isAuthenticated, token]);
	
	// Fetch submissions when authenticated
	useEffect(() => {
		if (isAuthenticated && token) {
			fetchSubmissions();
		}
	}, [isAuthenticated, token]);

	// Verify authentication
	const verifyAuth = async () => {
		if (!token) return;

		try {
			const response = await fetch("/api/verify", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				setUser(data.user);
				setIsAuthenticated(true);
			} else {
				localStorage.removeItem("token");
				setToken(null);
			}
		} catch (error) {
			localStorage.removeItem("token");
			setToken(null);
		}
	};

	// Register user
	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault();
		setAuthLoading(true);
		setAuthError("");

		try {
			const response = await fetch("/api/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(authData),
			});

			const data = await response.json();

			if (response.ok && data.success) {
				// Auto login after registration
				handleLogin(e);
			} else {
				setAuthError(data.error || "Registration failed");
			}
		} catch (error) {
			setAuthError("Network error. Please try again.");
		} finally {
			setAuthLoading(false);
		}
	};

	// Login user
	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setAuthLoading(true);
		setAuthError("");

		try {
			const response = await fetch("/api/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(authData),
			});

			const data = await response.json();

			if (response.ok && data.success) {
				setToken(data.token);
				setUser(data.user);
				setIsAuthenticated(true);
				localStorage.setItem("token", data.token);
				setAuthData({ username: "", password: "" });
			} else {
				setAuthError(data.error || "Login failed");
			}
		} catch (error) {
			setAuthError("Network error. Please try again.");
		} finally {
			setAuthLoading(false);
		}
	};

	// Logout
	const handleLogout = () => {
		setIsAuthenticated(false);
		setUser(null);
		setToken(null);
		localStorage.removeItem("token");
		setSubmissions([]);
	};

	// Fetch submissions
	const fetchSubmissions = async () => {
		if (!token) return;

		setLoading(true);
		try {
			const response = await fetch("/api/submissions", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				// Sort by timestamp, oldest first (so new posts append at bottom)
				const sorted = (data.submissions || []).sort(
					(a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
				);
				setSubmissions(sorted);
			}
		} catch (error) {
			console.error("Failed to fetch submissions:", error);
		} finally {
			setLoading(false);
		}
	};

	// Delete submission
	const handleDelete = async (id: string) => {
		if (!token || !confirm("Are you sure you want to delete this post?")) {
			return;
		}

		try {
			const response = await fetch(`/api/submissions/${id}`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				setSubmissions(submissions.filter((s) => s.id !== id));
			}
		} catch (error) {
			console.error("Failed to delete submission:", error);
		}
	};

	// Format time ago
	const getTimeAgo = (timestamp: string) => {
		const now = new Date();
		const time = new Date(timestamp);
		const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

		if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
		if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
		if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
		if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
		return time.toLocaleDateString();
	};

	// Get user avatar initial
	const getAvatar = (name: string) => {
		return name.charAt(0).toUpperCase();
	};

	// Handle form submission
	const handleFormSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormLoading(true);
		setFormStatus(null);

		try {
			const formDataToSend = new FormData();
			formDataToSend.append("name", formData.name);
			formDataToSend.append("email", formData.email);
			formDataToSend.append("message", formData.message);

			const response = await fetch("/api/submit", {
				method: "POST",
				body: formDataToSend,
			});

			const data = await response.json();

			if (response.ok && data.success) {
				setFormStatus({ type: "success", message: "Post submitted successfully! It will appear in the feed." });
				setFormData({ name: "", email: "", message: "" });
				// Don't refresh feed - WebSocket will handle the update
				// This prevents scrolling to top
			} else {
				setFormStatus({ type: "error", message: data.error || "Failed to submit post. Please try again." });
			}
		} catch (error) {
			setFormStatus({ type: "error", message: "Network error. Please check your connection and try again." });
		} finally {
			setFormLoading(false);
		}
	};

	// Login/Register UI
	if (!isAuthenticated) {
		return (
			<div style={{
				minHeight: "100vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
				padding: "1rem",
			}}>
				<div style={{
					background: "white",
					borderRadius: "16px",
					padding: "2rem",
					width: "100%",
					maxWidth: "400px",
					boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
				}}>
					<h1 style={{
						fontSize: "2rem",
						fontWeight: "bold",
						textAlign: "center",
						marginBottom: "0.5rem",
						background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
						WebkitBackgroundClip: "text",
						WebkitTextFillColor: "transparent",
					}}>
						{authMode === "login" ? "Welcome Back" : "Create Account"}
					</h1>
					<p style={{ textAlign: "center", color: "#6b7280", marginBottom: "2rem" }}>
						{authMode === "login" ? "Sign in to view the feed" : "Join us to see all posts"}
					</p>

					{authError && (
						<div style={{
							padding: "0.75rem",
							marginBottom: "1rem",
							background: "#fee2e2",
							color: "#991b1b",
							borderRadius: "8px",
							fontSize: "0.875rem",
						}}>
							{authError}
						</div>
					)}

					<form onSubmit={authMode === "login" ? handleLogin : handleRegister}>
						<div style={{ marginBottom: "1rem" }}>
							<label style={{
								display: "block",
								marginBottom: "0.5rem",
								fontWeight: "600",
								color: "#374151",
							}}>
								Username
							</label>
							<input
								type="text"
								required
								minLength={3}
								value={authData.username}
								onChange={(e) => setAuthData({ ...authData, username: e.target.value })}
								style={{
									width: "100%",
									padding: "0.75rem",
									border: "1px solid #d1d5db",
									borderRadius: "8px",
									fontSize: "1rem",
									boxSizing: "border-box",
								}}
								placeholder="Enter your username"
							/>
						</div>

						<div style={{ marginBottom: "1.5rem" }}>
							<label style={{
								display: "block",
								marginBottom: "0.5rem",
								fontWeight: "600",
								color: "#374151",
							}}>
								Password
							</label>
							<input
								type="password"
								required
								minLength={6}
								value={authData.password}
								onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
								style={{
									width: "100%",
									padding: "0.75rem",
									border: "1px solid #d1d5db",
									borderRadius: "8px",
									fontSize: "1rem",
									boxSizing: "border-box",
								}}
								placeholder="Enter your password"
							/>
						</div>

						<button
							type="submit"
							disabled={authLoading}
							style={{
								width: "100%",
								padding: "0.75rem",
								background: authLoading ? "#9ca3af" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
								color: "white",
								border: "none",
								borderRadius: "8px",
								fontSize: "1rem",
								fontWeight: "600",
								cursor: authLoading ? "not-allowed" : "pointer",
								marginBottom: "1rem",
							}}
						>
							{authLoading ? "Please wait..." : authMode === "login" ? "Sign In" : "Sign Up"}
						</button>
					</form>

					<div style={{ textAlign: "center" }}>
						<button
							type="button"
							onClick={() => {
								setAuthMode(authMode === "login" ? "register" : "login");
								setAuthError("");
							}}
							style={{
								background: "none",
								border: "none",
								color: "#667eea",
								cursor: "pointer",
								fontSize: "0.875rem",
								textDecoration: "underline",
							}}
						>
							{authMode === "login"
								? "Don't have an account? Sign up"
								: "Already have an account? Sign in"}
						</button>
					</div>
				</div>
			</div>
		);
	}

	// Feed UI
	return (
		<div style={{
			minHeight: "100vh",
			background: "#f3f4f6",
		}}>
			{/* Header */}
			<header style={{
				background: "white",
				borderBottom: "1px solid #e5e7eb",
				padding: "1rem 0",
				position: "sticky",
				top: 0,
				zIndex: 100,
				boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
			}}>
				<div style={{
					maxWidth: "600px",
					margin: "0 auto",
					padding: "0 1rem",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}}>
					<h1 style={{
						fontSize: "1.5rem",
						fontWeight: "bold",
						background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
						WebkitBackgroundClip: "text",
						WebkitTextFillColor: "transparent",
						margin: 0,
					}}>
						Feed
					</h1>
					<div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
						<span style={{ color: "#6b7280", fontSize: "0.875rem" }}>
							@{user?.username}
						</span>
						<button
							onClick={handleLogout}
							style={{
								padding: "0.5rem 1rem",
								background: "#ef4444",
								color: "white",
								border: "none",
								borderRadius: "6px",
								cursor: "pointer",
								fontSize: "0.875rem",
								fontWeight: "600",
							}}
						>
							Logout
						</button>
					</div>
				</div>
			</header>

			{/* Feed Content */}
			<main style={{
				maxWidth: "600px",
				margin: "0 auto",
				padding: "1rem",
			}}>
				{/* Create Post Form */}
				<div style={{
					background: "white",
					borderRadius: "12px",
					padding: "1.5rem",
					marginBottom: "1rem",
					boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
					border: "1px solid #e5e7eb",
				}}>
					<h2 style={{
						margin: "0 0 1rem 0",
						fontSize: "1.25rem",
						fontWeight: "600",
						color: "#111827",
					}}>
						Create New Post
					</h2>

					{formStatus && (
						<div style={{
							padding: "0.75rem",
							marginBottom: "1rem",
							borderRadius: "8px",
							background: formStatus.type === "success" ? "#d1fae5" : "#fee2e2",
							color: formStatus.type === "success" ? "#065f46" : "#991b1b",
							fontSize: "0.875rem",
						}}>
							{formStatus.message}
						</div>
					)}

					<form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
						<div>
							<label htmlFor="name" style={{
								display: "block",
								marginBottom: "0.5rem",
								fontWeight: "600",
								color: "#374151",
								fontSize: "0.875rem",
							}}>
								Your Name *
							</label>
							<input
								type="text"
								id="name"
								required
								minLength={2}
								value={formData.name}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								style={{
									width: "100%",
									padding: "0.75rem",
									border: "1px solid #d1d5db",
									borderRadius: "8px",
									fontSize: "1rem",
									boxSizing: "border-box",
								}}
								placeholder="Enter your name"
							/>
						</div>

						<div>
							<label htmlFor="email" style={{
								display: "block",
								marginBottom: "0.5rem",
								fontWeight: "600",
								color: "#374151",
								fontSize: "0.875rem",
							}}>
								Your Email *
							</label>
							<input
								type="email"
								id="email"
								required
								value={formData.email}
								onChange={(e) => setFormData({ ...formData, email: e.target.value })}
								style={{
									width: "100%",
									padding: "0.75rem",
									border: "1px solid #d1d5db",
									borderRadius: "8px",
									fontSize: "1rem",
									boxSizing: "border-box",
								}}
								placeholder="your.email@example.com"
							/>
						</div>

						<div>
							<label htmlFor="message" style={{
								display: "block",
								marginBottom: "0.5rem",
								fontWeight: "600",
								color: "#374151",
								fontSize: "0.875rem",
							}}>
								Message *
							</label>
							<textarea
								id="message"
								required
								minLength={10}
								rows={4}
								value={formData.message}
								onChange={(e) => setFormData({ ...formData, message: e.target.value })}
								style={{
									width: "100%",
									padding: "0.75rem",
									border: "1px solid #d1d5db",
									borderRadius: "8px",
									fontSize: "1rem",
									resize: "vertical",
									boxSizing: "border-box",
									fontFamily: "inherit",
								}}
								placeholder="What's on your mind? (minimum 10 characters)"
							/>
							<p style={{
								margin: "0.25rem 0 0 0",
								fontSize: "0.75rem",
								color: "#6b7280",
							}}>
								Your message will be checked for spam before posting.
							</p>
						</div>

						<button
							type="submit"
							disabled={formLoading}
							style={{
								padding: "0.75rem 1.5rem",
								background: formLoading ? "#9ca3af" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
								color: "white",
								border: "none",
								borderRadius: "8px",
								cursor: formLoading ? "not-allowed" : "pointer",
								fontWeight: "600",
								fontSize: "1rem",
							}}
						>
							{formLoading ? "Submitting..." : "Post"}
						</button>
					</form>
				</div>

				{loading ? (
					<div style={{
						textAlign: "center",
						padding: "3rem",
						color: "#6b7280",
					}}>
						Loading posts...
					</div>
				) : submissions.length === 0 ? (
					<div style={{
						textAlign: "center",
						padding: "3rem",
						background: "white",
						borderRadius: "12px",
						marginTop: "1rem",
					}}>
						<p style={{ color: "#6b7280", fontSize: "1.125rem" }}>
							No posts yet. Be the first to submit a form!
						</p>
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
						{submissions.map((submission) => (
							<article
								key={submission.id}
								style={{
									background: "white",
									borderRadius: "12px",
									padding: "1rem",
									boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
									border: "1px solid #e5e7eb",
								}}
							>
								{/* Post Header */}
								<div style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "start",
									marginBottom: "0.75rem",
								}}>
									<div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
										<div style={{
											width: "40px",
											height: "40px",
											borderRadius: "50%",
											background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											color: "white",
											fontWeight: "bold",
											fontSize: "1.125rem",
										}}>
											{getAvatar(submission.name)}
										</div>
										<div>
											<h3 style={{
												margin: 0,
												fontSize: "1rem",
												fontWeight: "600",
												color: "#111827",
											}}>
												{submission.name}
											</h3>
											<p style={{
												margin: 0,
												fontSize: "0.875rem",
												color: "#6b7280",
											}}>
												{submission.email} · {getTimeAgo(submission.timestamp)}
											</p>
										</div>
									</div>
									<button
										onClick={() => handleDelete(submission.id)}
										style={{
											background: "none",
											border: "none",
											color: "#ef4444",
											cursor: "pointer",
											padding: "0.25rem",
											fontSize: "1.25rem",
										}}
										title="Delete post"
									>
										🗑️
									</button>
								</div>

								{/* Post Content */}
								<div style={{
									marginTop: "0.75rem",
									color: "#374151",
									lineHeight: "1.6",
									whiteSpace: "pre-wrap",
									wordBreak: "break-word",
								}}>
									{submission.message}
								</div>

								{/* Post Footer */}
								<div style={{
									marginTop: "1rem",
									paddingTop: "0.75rem",
									borderTop: "1px solid #e5e7eb",
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
								}}>
									<span style={{
										fontSize: "0.75rem",
										color: "#9ca3af",
									}}>
										{new Date(submission.timestamp).toLocaleString()}
									</span>
								</div>
							</article>
						))}
					</div>
				)}

				{/* Refresh Button */}
				{!loading && submissions.length > 0 && (
					<div style={{ textAlign: "center", marginTop: "2rem" }}>
						<button
							onClick={fetchSubmissions}
							style={{
								padding: "0.75rem 1.5rem",
								background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
								color: "white",
								border: "none",
								borderRadius: "8px",
								cursor: "pointer",
								fontWeight: "600",
							}}
						>
							🔄 Refresh Feed
						</button>
					</div>
				)}
			</main>
		</div>
	);
}

export default App;
