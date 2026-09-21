import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SchoolLib — School Library Management System" },
      {
        name: "description",
        content:
          "SchoolLib: manage a school library catalogue, students, book loans, returns and overdue fines.",
      },
      { property: "og:title", content: "SchoolLib — School Library Management System" },
      {
        property: "og:description",
        content:
          "Manage a school library catalogue, students, book loans, returns and overdue fines.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// The library system is a standalone HTML/CSS/JS app served from /library/.
// Opening the site sends you straight to its dashboard.
function Index() {
  useEffect(() => {
    window.location.replace("/library/index.html");
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <p className="text-muted-foreground">
        Opening SchoolLib…{" "}
        <a className="underline" href="/library/index.html">
          Click here if nothing happens
        </a>
      </p>
    </div>
  );
}
