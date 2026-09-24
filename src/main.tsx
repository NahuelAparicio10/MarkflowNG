import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installDevFixtureHatch } from "./store/devFixtureHatch";
import { openStartupFile } from "./store/startupFile";
import "./styles.css";

// Query after module initialization so the backend startup path cannot be lost
// to an event emitted before the webview is ready.
void openStartupFile();
installDevFixtureHatch();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
