"use client";

import { LazyMotion, MotionConfig } from "motion/react";

// Features werden nach der Hydration nachgeladen – hält das initiale JS klein.
const loadFeatures = () => import("./motion-features").then((m) => m.default);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.9 }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
