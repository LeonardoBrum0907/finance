import { motion } from "framer-motion";
import {
  CircleAlert,
  CircleCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { AssistantSpotlightButton } from "../chat/AssistantSpotlightButton";
import { cardLargeClass, fadeUp } from "./motion";

interface Props {
  insights: string[];
  personId?: string;
}

type InsightType = "success" | "info" | "warning";

const TYPE_STYLES: Record<
  InsightType,
  { container: string; iconBox: string; icon: LucideIcon; iconColor: string }
> = {
  success: {
    container: "border-emerald-500/15 bg-emerald-500/5",
    iconBox: "bg-emerald-500/10",
    icon: CircleCheck,
    iconColor: "text-emerald-600",
  },
  info: {
    container: "border-sky-500/15 bg-sky-500/5",
    iconBox: "bg-sky-500/10",
    icon: TrendingUp,
    iconColor: "text-sky-600",
  },
  warning: {
    container: "border-amber-500/15 bg-amber-500/5",
    iconBox: "bg-amber-500/10",
    icon: CircleAlert,
    iconColor: "text-amber-600",
  },
};

function resolveType(text: string, index: number): InsightType {
  const lower = text.toLowerCase();
  if (
    index === 0 ||
    lower.includes("menos") ||
    lower.includes("economiz") ||
    lower.includes("caiu")
  ) {
    return "success";
  }
  if (index === 1 || lower.includes("caminho") || lower.includes("meta")) {
    return "info";
  }
  if (lower.includes("detect") || lower.includes("alerta") || lower.includes("futur")) {
    return "warning";
  }
  return index % 3 === 0 ? "success" : index % 3 === 1 ? "info" : "warning";
}

export function InsightsPanel({ insights, personId }: Props) {
  if (insights.length === 0) return null;

  return (
    <motion.section
      custom={4}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cardLargeClass}
    >
      <div className="mb-4">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Insights Inteligentes
        </h2>
        <p className="text-[11px] text-slate-400">
          Notificações preditivas adaptadas ao seu perfil
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {insights.map((text, i) => {
          const type = resolveType(text, i);
          const style = TYPE_STYLES[type];
          const Icon = style.icon;

          return (
            <li
              key={i}
              className={`flex gap-3 rounded-2xl border px-4 py-3 ${style.container}`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${style.iconBox}`}
              >
                <Icon className={`h-4 w-4 ${style.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold leading-snug text-slate-800">{text}</p>
                <div className="mt-2">
                  <AssistantSpotlightButton
                    message={`Explique este insight e sugira uma ação prática: "${text}"`}
                    contextKey={`insight:${type}`}
                    title="Insight"
                    personId={personId}
                    contextHint={JSON.stringify({ source: "insight", text, type })}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}
