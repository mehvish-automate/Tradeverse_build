import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Join the TradeVerse closed beta. 18+ only. No trading, no KYC, no real money.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
