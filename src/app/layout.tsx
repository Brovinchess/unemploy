import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AnalyticsIdentity } from "@/components/analytics-identity";
import { getCurrentUser } from "@/lib/session";

// Plus Jakarta Sans for headings and buttons, Inter for reading text.
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const SITE = process.env.APP_URL || "https://careerninja.app";
// Search snippets. Title: the words people search for first, the brand last, under 60 characters.
// Description: one benefit per clause, under 155 characters so Google shows all of it.
const TITLE = "AI Job Search Agent and Application Autofill | Career Ninja";
const DESCRIPTION = "Your own AI headhunter. It finds open jobs that fit your resume, writes each application and fills the form in Chrome. You press Submit. Free to start.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: "%s | Career Ninja" },
  description: DESCRIPTION,
  applicationName: "Career Ninja",
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: SITE, siteName: "Career Ninja", type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" } },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser().catch(() => null);
  return (
    // The Career Ninja extension marks <html> before React loads, so attributes there differ.
    <html lang="en" className={`${jakarta.variable} ${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        {user && <AnalyticsIdentity id={user.id} username={user.username} />}
        {children}
      </body>
    </html>
  );
}
