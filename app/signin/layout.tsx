import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to TradeVerse and pick up your streak.",
};

export default function SigninLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
