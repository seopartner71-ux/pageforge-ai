import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { patchFetchForBackendProxy } from "./lib/backendProxy";

patchFetchForBackendProxy();

createRoot(document.getElementById("root")!).render(<App />);
