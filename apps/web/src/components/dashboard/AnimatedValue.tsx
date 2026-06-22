import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useReducedMotion } from "../../hooks/useReducedMotion";

interface Props {
  value: number;
  format: (n: number) => string;
  className?: string;
}

export function AnimatedValue({ value, format, className }: Props) {
  const reducedMotion = useReducedMotion();
  const motionValue = useMotionValue(reducedMotion ? value : 0);
  const display = useTransform(motionValue, (v) => format(v));

  useEffect(() => {
    if (reducedMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration: 0.7,
      ease: "easeOut",
    });
    return controls.stop;
  }, [value, motionValue, reducedMotion]);

  return <motion.span className={className}>{display}</motion.span>;
}
