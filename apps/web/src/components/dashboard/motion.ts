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
  "rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm";

export const cardHighlightClass =
  "rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6";

export const cardLargeClass =
  "rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm";

export const creditCardDarkClass =
  "rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-100";

export const creditCardEcoClass =
  "rounded-2xl border border-emerald-600/35 bg-gradient-to-r from-emerald-950 to-teal-900 p-5 text-emerald-100";
