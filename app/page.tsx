import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { HeroOfferings } from "@/components/HeroOfferings";
import { Nav } from "@/components/Nav";
import { Problem } from "@/components/Problem";
import { Vision } from "@/components/Vision";
import { WelcomeBackBanner } from "@/components/WelcomeBackBanner";

export default function Home() {
  return (
    <>
      <Nav />
      <WelcomeBackBanner />
      <main>
        <Hero />
        <Problem />
        <Vision />
        <HeroOfferings />
      </main>
      <Footer />
    </>
  );
}
