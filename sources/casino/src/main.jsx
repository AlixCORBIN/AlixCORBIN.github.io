import './styles/app.css';
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { startCloudSave } from "./lib/cloudSave.js";
import { SaveChooser } from "./ui/SaveChooser.jsx";

startCloudSave();

createRoot(document.getElementById("root")).render(
  <>
    <App />
    <SaveChooser />
  </>,
);
