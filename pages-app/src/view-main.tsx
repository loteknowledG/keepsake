import { createRoot } from "react-dom/client";
import SharedLoadViewPage from "./shared-load-view-page";
import "./style.css";

const root = document.getElementById("root");
if (!root) throw new Error("View root element is missing.");

createRoot(root).render(<SharedLoadViewPage />);
