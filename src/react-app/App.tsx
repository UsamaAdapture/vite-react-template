// src/App.tsx

import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import cloudflareLogo from "./assets/Cloudflare_Logo.svg";
import honoLogo from "./assets/hono.svg";
import "./App.css";

function App() {
	const [count, setCount] = useState(0);
	const [name, setName] = useState("unknown");

	const [text, setText] = useState("");

	const [key, setKey] = useState("");
	const [result, setResult] = useState("");
	
	const [inputText, setInputText] = useState("");
	const [poem, setPoem] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
  
	const generatePoem = async () => {
	  // Clear previous error message
	  setErrorMessage("");
  
	  // Send request to backend to generate a poem
	  const response = await fetch("/generate-poem", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ inputText }),
	  });
  
	  const data = await response.json();

	  console.log(data);
  
	  if (data.status === "ok") {
		setPoem(data.poem);  // Set the generated poem
	  } else {
		setErrorMessage(data.message);  // Show error message
	  }
	};
  
  
	// Function to check the key in the KV store
	const checkKey = async () => {
	  const response = await fetch("/check-key", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ key }),
	  });
  
	  const data = await response.json();
  
	  if (data.status === "ok") {
		setResult(`The value for the key "${key}" is: ${data.value}`);
	  } else {
		setResult(data.message || "An unknown error occurred");
	  }
	};

	return (
		<>
			<div>
				<a href="https://vite.dev" target="_blank">
					<img src={viteLogo} className="logo" alt="Vite logo" />
				</a>
				<a href="https://react.dev" target="_blank">
					<img src={reactLogo} className="logo react" alt="React logo" />
				</a>
				<a href="https://hono.dev/" target="_blank">
					<img src={honoLogo} className="logo cloudflare" alt="Hono logo" />
				</a>
				<a href="https://workers.cloudflare.com/" target="_blank">
					<img
						src={cloudflareLogo}
						className="logo cloudflare"
						alt="Cloudflare logo"
					/>
				</a>
			</div>
			<h1>Vite + React + Hono + Cloudflare</h1>
			<div className="card">
				<button
					onClick={() => setCount((count) => count + 1)}
					aria-label="increment"
				>
					count is {count}
				</button>
				<p>
					Edit <code>src/App.tsx</code> and save to test HMR
				</p>
			</div>
			<div className="card">
				<button
					onClick={() => {
						fetch("/api/")
							.then((res) => res.json() as Promise<{ name: string }>)
							.then((data) => setName(data.name));
					}}
					aria-label="get name"
				>
					Name from API is: {name}
				</button>
				<p>
					Edit <code>worker/index.ts</code> to change the name
				</p>
			</div>

			<div className="card">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text"
        />
        <button
          onClick={() => {
            fetch("/post/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: text }),
            });
          }}
        >
          Send POST
        </button>
      </div>

	  <div className="card">
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Enter key"
        />
        <button onClick={checkKey}>Check Key</button>
        <p>{result}</p>
      </div>

	  <div className="card">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Enter a topic for the poem (max 50 chars)"
        />
        <button onClick={generatePoem}>Generate Poem</button>

        {poem && <div><h3>Generated Poem:</h3><p>{poem}</p></div>}

        {errorMessage && <div style={{ color: "red" }}><p>{errorMessage}</p></div>}
      </div>

			<p className="read-the-docs">Click on the logos to learn more</p>

			<p>Here: {import.meta.env.ENV_DATA}</p>
		</>
	);
}

export default App;
