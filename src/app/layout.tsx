import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitMetrix — Developer Velocity Dashboard",
  description:
    "Visualize your GitHub activity with real-time velocity scoring, contribution analytics, and language breakdowns.",
  keywords: ["GitHub", "developer", "analytics", "velocity", "dashboard"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#6366F1",
          colorBackground: "#0F0F0F",
          colorInputBackground: "#050505",
          colorInputText: "#e5e5e5",
          colorText: "#e5e5e5",
          colorTextSecondary: "#a1a1aa",
          borderRadius: "0.75rem",
        },
        elements: {
          card: "bg-[#0F0F0F] border border-[#27272A] shadow-2xl",
          headerTitle: "text-white",
          headerSubtitle: "text-zinc-400",
          socialButtonsBlockButton:
            "bg-[#050505] border-[#27272A] text-white hover:bg-[#1a1a1a] transition-colors",
          socialButtonsBlockButtonText: "text-white font-medium",
          formButtonPrimary:
            "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition-all",
          footerActionLink: "text-indigo-400 hover:text-indigo-300",
          identityPreviewEditButton: "text-indigo-400",
        },
      }}
    >
      <html lang="en" className="dark">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="min-h-screen bg-void antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
