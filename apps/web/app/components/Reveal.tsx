"use client";

import { motion, type Variants } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

type Variant = "up" | "right" | "scale";

const variants: Record<Variant, Variants> = {
  up: {
    hidden: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0 },
  },
  right: {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.94 },
    visible: { opacity: 1, scale: 1 },
  },
};

type Props = {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span" | "h2" | "h3" | "p";
  style?: CSSProperties;
};

export default function Reveal({
  children,
  variant = "up",
  delay = 0,
  className,
  as = "div",
  style,
}: Props) {
  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "0px 0px -60px 0px", amount: 0.12 }}
      variants={variants[variant]}
      transition={{ duration: 0.9, ease: "easeOut", delay }}
    >
      {children}
    </MotionTag>
  );
}
