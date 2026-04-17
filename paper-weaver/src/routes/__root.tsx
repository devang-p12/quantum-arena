import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import appCss from "../styles.css?url";
import { AppShell } from "@/components/AppShell";
import { authService } from "@/lib/authService";

const PUBLIC_PATHS = ["/auth"];

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ExamForge — AI Exam Paper Generator" },
      { name: "description", content: "Design, generate, edit, and analyze university exam papers with AI assistance." },
      { name: "author", content: "ExamForge" },
      { property: "og:title", content: "ExamForge — AI Exam Paper Generator" },
      { property: "og:description", content: "Design, generate, edit, and analyze university exam papers with AI assistance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

/**
 * RootComponent renders consistently on server and client to avoid hydration mismatch.
 * Auth redirect is deferred to a useEffect (client-only) so SSR output always matches.
 */
function RootComponent() {
  const [isAuthRoute, setIsAuthRoute] = useState(false);

  useEffect(() => {
    const pathname = window.location.pathname;
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    const authed = authService.isAuthenticated();

    if (!isPublic && !authed) {
      window.location.replace("/auth");
      return;
    }
    if (isPublic && authed) {
      window.location.replace("/");
      return;
    }

    setIsAuthRoute(isPublic);
  }, []);

  // During SSR and first render: always show Outlet so server HTML matches client
  // After hydration, if it's the auth route, we strip the AppShell wrapper
  if (isAuthRoute) {
    return <Outlet />;
  }

  return <AppShell />;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <a href="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Go home
        </a>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
