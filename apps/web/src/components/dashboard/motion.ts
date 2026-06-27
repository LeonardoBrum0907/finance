import type { Variants } from "framer-motion";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: "easeOut" },
  }),
};

export const cardClass =
  "rounded-card border border-app-border/60 bg-app-surface p-6 shadow-card";

export const cardHighlightClass =
  "rounded-card border border-positive/20 bg-positive/5 p-6";

export const cardLargeClass =
  "rounded-card-lg border border-app-border/60 bg-app-surface p-6 shadow-card";

export const creditCardDarkClass =
  "rounded-card border border-sidebar-active bg-sidebar p-5 text-slate-100";

export const creditCardEcoClass =
  "rounded-card border border-positive/35 bg-positive/20 p-5 text-foreground";
