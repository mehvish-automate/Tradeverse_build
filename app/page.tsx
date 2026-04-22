import { Boundaries } from "@/components/Boundaries";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { HeroOfferings } from "@/components/HeroOfferings";
import { Nav } from "@/components/Nav";
import { Personas } from "@/components/Personas";
import { Problem } from "@/components/Problem";
import { Vision } from "@/components/Vision";
import { Waitlist } from "@/components/Waitlist";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Vision />
        <HeroOfferings />
        <Personas />
        <Boundaries />
        <Waitlist />
      </main>
      <Footer />
    </>
  );
}
