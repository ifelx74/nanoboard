import { createRoot } from "react-dom/client";
import "./index.css";
import { Button } from "./components/ui/button";

const App = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
    <Button variant="default">Default</Button>
    <Button variant="outline">Outline</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="destructive">Destructive</Button>
    <Button variant="link">Link</Button>
  </div>
);

createRoot(document.getElementById("app")!).render(<App />);
