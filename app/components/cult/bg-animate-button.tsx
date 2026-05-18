import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const outerVariants = cva("relative inline-block overflow-hidden", {
  variants: {
    rounded: {
      none: "",
      sm: "rounded-sm before:rounded-sm",
      base: "rounded before:rounded",
      xl: "rounded-xl before:rounded-xl",
      full: "rounded-full before:rounded-full",
    },
  },
  defaultVariants: { rounded: "none" },
});

const conicVariants = cva("absolute inset-[-1000%] m-auto block", {
  variants: {
    animation: {
      spin: "animate-[spin_4s_linear_infinite]",
      "spin-slow": "animate-[spin_8s_linear_infinite]",
      "spin-fast": "animate-[spin_2s_linear_infinite]",
      pulse: "animate-pulse",
    },
    gradient: {
      iron: "bg-[conic-gradient(from_90deg_at_50%_50%,#e84b1f_0%,#b3360e_50%,#e84b1f_100%)]",
      ember:
        "bg-[conic-gradient(from_90deg_at_50%_50%,#e84b1f_0%,#f4f1ea_30%,#e84b1f_60%,#0a0a0a_100%)]",
      ghost:
        "bg-[conic-gradient(from_90deg_at_50%_50%,#2e2e2e_0%,#f4f1ea_50%,#2e2e2e_100%)]",
    },
  },
  defaultVariants: { animation: "spin", gradient: "iron" },
});

const innerVariants = cva(
  "relative transition-all duration-150 ease-in-out disabled:pointer-events-none disabled:opacity-50 overflow-hidden font-mono uppercase tracking-[0.18em] text-[11px] inline-flex items-center gap-2",
  {
    variants: {
      size: {
        sm: "px-4 py-2",
        default: "px-6 py-3",
        lg: "px-8 py-4",
      },
      tone: {
        light: "bg-fg text-bg",
        dark: "bg-bg text-fg",
        accent: "bg-accent text-bg",
      },
      rounded: {
        none: "",
        sm: "rounded-sm",
        base: "rounded",
        xl: "rounded-xl",
        full: "rounded-full",
      },
    },
    defaultVariants: { size: "default", tone: "dark", rounded: "none" },
  }
);

type SharedProps = {
  size?: "sm" | "default" | "lg";
  rounded?: "none" | "sm" | "base" | "xl" | "full";
  tone?: "light" | "dark" | "accent";
  animation?: "spin" | "spin-slow" | "spin-fast" | "pulse";
  gradient?: "iron" | "ember" | "ghost";
  /** Thickness of the visible animated border ring (px). Default 2. */
  ringWidth?: number;
  className?: string;
  children?: React.ReactNode;
};

export type BgAnimateButtonProps = SharedProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof SharedProps> & {
    href?: undefined;
  };

export type BgAnimateAnchorProps = SharedProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof SharedProps> & {
    href: string;
  };

function Inner({
  size,
  rounded,
  tone,
  gradient,
  animation,
  ringWidth,
  children,
}: SharedProps) {
  return (
    <>
      <span className={cn(conicVariants({ animation, gradient }))} />
      <span
        className={cn(innerVariants({ size, tone, rounded }))}
        style={{ margin: ringWidth }}
      >
        {children}
      </span>
    </>
  );
}

export function BgAnimateButton(
  props: BgAnimateButtonProps | BgAnimateAnchorProps
) {
  const {
    size = "default",
    rounded = "none",
    tone = "dark",
    gradient = "iron",
    animation = "spin",
    ringWidth = 2,
    className,
    children,
    ...rest
  } = props;

  const inner = (
    <Inner
      size={size}
      rounded={rounded}
      tone={tone}
      gradient={gradient}
      animation={animation}
      ringWidth={ringWidth}
    >
      {children}
    </Inner>
  );

  if ("href" in props && props.href) {
    return (
      <a
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        className={cn(outerVariants({ rounded }), className)}
      >
        {inner}
      </a>
    );
  }
  return (
    <button
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      className={cn(outerVariants({ rounded }), className)}
    >
      {inner}
    </button>
  );
}
