"use client";

import { useEffect } from "react";

/// Adds the .is-visible class to every .reveal element as it scrolls into view.
/// The actual fade/rise animation lives in globals.css and is already disabled
/// under prefers-reduced-motion there — this hook only toggles the class.
export function useScrollReveal() {
  useEffect(() => {
    const elements = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}
