import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installDevFixtureHatch } from "./store/devFixtureHatch";
import { listenForStartupFile } from "./store/startupFile";
import "./styles.css";

// Registered before React renders so the listener is in place as early as
// possible — see `listenForStartupFile` for why that matters.
listenForStartupFile();
installDevFixtureHatch();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
