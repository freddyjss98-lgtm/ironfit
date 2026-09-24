"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  type HTMLMotionProps,
} from "framer-motion";
import useMeasure from "react-use-measure";

import { cn } from "@/lib/utils";

const springConfig = { stiffness: 200, damping: 24, bounce: 0.1 };

type Ctx = {
  isExpanded: boolean;
  toggle: () => void;
  transitionDuration: number;
};

const ExpandableContext = createContext<Ctx>({
  isExpanded: false,
  toggle: () => {},
  transitionDuration: 0.3,
});

export const useExpandable = () => useContext(ExpandableContext);

type ExpandableProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children: ReactNode | ((props: { isExpanded: boolean }) => ReactNode);
  expanded?: boolean;
  onToggle?: () => void;
  transitionDuration?: number;
};

export const Expandable = React.forwardRef<HTMLDivElement, ExpandableProps>(
  ({ children, expanded, onToggle, transitionDuration = 0.3, ...props }, ref) => {
    const [internal, setInternal] = useState(false);
    const isExpanded = expanded ?? internal;
    const toggle = onToggle ?? (() => setInternal((v) => !v));

    return (
      <ExpandableContext.Provider value={{ isExpanded, toggle, transitionDuration }}>
        <motion.div ref={ref} {...props}>
          {typeof children === "function" ? children({ isExpanded }) : children}
        </motion.div>
      </ExpandableContext.Provider>
    );
  }
);
Expandable.displayName = "Expandable";

type TriggerProps = React.HTMLAttributes<HTMLDivElement>;

export const ExpandableTrigger = React.forwardRef<HTMLDivElement, TriggerProps>(
  ({ children, className, onClick, ...props }, ref) => {
    const { toggle } = useExpandable();
    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={(e) => {
          onClick?.(e);
          toggle();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className={cn("cursor-pointer", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ExpandableTrigger.displayName = "ExpandableTrigger";

type ContentProps = Omit<HTMLMotionProps<"div">, "ref">;

export const ExpandableContent = React.forwardRef<HTMLDivElement, ContentProps>(
  ({ children, ...props }, ref) => {
    const { isExpanded, transitionDuration } = useExpandable();
    const [measureRef, { height }] = useMeasure();
    const animated = useMotionValue(0);
    const smooth = useSpring(animated, springConfig);

    useEffect(() => {
      animated.set(isExpanded ? height : 0);
    }, [isExpanded, height, animated]);

    return (
      <motion.div
        ref={ref}
        style={{ height: smooth, overflow: "hidden" }}
        transition={{ duration: transitionDuration }}
        {...props}
      >
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              ref={measureRef}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: transitionDuration }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
);
ExpandableContent.displayName = "ExpandableContent";
