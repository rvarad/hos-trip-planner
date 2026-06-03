"use client";

// App Router error boundary: Next renders this if the page throws while
// rendering (a bug we didn't anticipate), instead of white-screening. Event-
// handler failures (like a failed plan request) are handled in-component and
// don't reach here. Kept dependency-free so it shows even if the theme is broken.

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface it for debugging; a real app would send this to a logger.
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        textAlign: "center",
        background: "#0b0f14",
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
        Something went wrong
      </h1>
      <p style={{ maxWidth: 420, color: "#94a3b8", margin: 0 }}>
        The app hit an unexpected error. You can try again — your inputs may need
        to be re-entered.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "10px 20px",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 15,
          color: "#fff",
          background: "linear-gradient(135deg, #38bdf8, #6366f1)",
        }}
      >
        Try again
      </button>
    </div>
  );
}
