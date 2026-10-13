import './styles/app.css';
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { startCloudSave } from "./lib/cloudSave.js";
import { SaveChooser } from "./ui/SaveChooser.jsx";
// Thème commun, chargé après les feuilles des jeux
import "./styles/theme.css";

startCloudSave();

createRoot(document.getElementById("root")).render(
  <>
    <App />
    <SaveChooser />
  </>,
);
