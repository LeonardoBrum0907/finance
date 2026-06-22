import { motion } from "framer-motion";
import { cardClass, fadeUp } from "./motion";

interface Props {
  insights: string[];
}

export function InsightsPanel({ insights }: Props) {
  if (insights.length === 0) return null;

  return (
    <motion.section
      custom={4}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cardClass}
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-800">Insights</h2>
        <p className="text-sm text-slate-500">Comparativos automáticos do período</p>
      </div>

      <ul className="space-y-3">
        {insights.map((text, i) => (
          <li
            key={i}
            className="flex gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
          >
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500"
              aria-hidden
            />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
