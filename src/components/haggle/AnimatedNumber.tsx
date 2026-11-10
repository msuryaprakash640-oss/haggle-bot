import { animate, useInView } from "motion/react";
import { useEffect, useRef } from "react";
import { formatINR } from "@/lib/haggle";

interface Props {
  value: number;
  from?: number;
  duration?: number;
  currency?: boolean;
  className?: string;
  suffix?: string;
}

export function AnimatedNumber({
  value,
  from = 0,
  duration = 1.4,
  currency = true,
  className,
  suffix = "",
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const last = useRef(from);

  useEffect(() => {
    if (!inView || !ref.current) return;
    const node = ref.current;
    const controls = animate(last.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = (currency ? formatINR(v) : Math.round(v).toLocaleString("en-IN")) + suffix;
      },
    });
    last.current = value;
    return () => controls.stop();
  }, [value, inView, duration, currency, suffix]);

  return (
    <span ref={ref} className={className}>
      {(currency ? formatINR(from) : from.toLocaleString("en-IN")) + suffix}
    </span>
  );
}
