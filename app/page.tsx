import { Hero } from "@/components/Hero";
import { HeroOfferings } from "@/components/HeroOfferings";
import { Nav } from "@/components/Nav";
import { Problem } from "@/components/Problem";
import { Vision } from "@/components/Vision";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Vision />
        <HeroOfferings />
      </main>
    </>
  );
}
