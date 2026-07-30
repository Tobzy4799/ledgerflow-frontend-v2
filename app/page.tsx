"use client";

import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { StatsBar } from "@/components/StatsBar";
import { FeatureGrid } from "@/components/FeatureGrid";
import { HowItWorksRail } from "@/components/HowItWorksRail";
import { Footer } from "@/components/Footer";
import { useScrollReveal } from "@/lib/useScrollReveal";

export default function LandingPage() {
  useScrollReveal();

  return (
    <>
      <Navbar />
      <Hero />
      <StatsBar />
      <FeatureGrid />
      <HowItWorksRail />
      <Footer />
    </>
  );
}