import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4">
      <nav className="flex gap-4">
        <Link to="/" className="[&.active]:font-bold">
          Home
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">Welcome Home!</h1>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="default">Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </div>
    </div>
  );
}
