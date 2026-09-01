import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Construction } from "lucide-react";

import { SuiSureLogo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/coming-soon")({
  head: () => ({
    meta: [
      { title: "Coming Soon — SuiSure" },
      {
        name: "description",
        content: "This SuiSure page is coming soon. Check back later.",
      },
      { property: "og:title", content: "Coming Soon — SuiSure" },
      {
        property: "og:description",
        content: "This SuiSure page is coming soon. Check back later.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComingSoon,
});

function ComingSoon() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 w-full border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <SuiSureLogo />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="rounded-full border border-border p-4">
          <Construction className="h-8 w-8 text-primary" />
        </div>
        <h1 className="mt-6 text-4xl font-bold uppercase tracking-tight text-foreground sm:text-5xl">
          Coming Soon
        </h1>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground sm:text-base">
          We are building something useful. This page will be ready soon.
        </p>
        <Button asChild className="mt-8 rounded-full" variant="outline">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back Home
          </Link>
        </Button>
      </main>
    </div>
  );
}
