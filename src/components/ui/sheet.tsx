"use client";

import { AnimatePresence, m, useDragControls } from "motion/react";
import { useEffect, useRef } from "react";
import { CloseIcon } from "../icons";

/**
 * Bottom-Sheet im iOS-Stil: gleitet per Feder hoch, lässt sich nach unten
 * wegziehen, Escape schließt, Fokus bleibt im Sheet.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const controls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => panel.current?.querySelector<HTMLElement>("button, input, [href]")?.focus(), 30);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>("button, input, select, [href]");
        const first = f[0];
        const last = f[f.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[55]">
          <m.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <m.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="safe-bottom absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[1.5rem] bg-surface shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
          >
            <div
              className="flex cursor-grab touch-none items-center justify-between px-4 pb-2 pt-2"
              onPointerDown={(e) => controls.start(e)}
            >
              <span className="w-8" />
              <div className="flex flex-col items-center">
                <span className="mb-2 h-1 w-9 rounded-full bg-surface-3" aria-hidden="true" />
                <h2 className="text-[1.0625rem] font-semibold">{title}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Schließen"
                className="press grid size-8 place-items-center rounded-full bg-surface-2 text-fg-2"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
            {footer && <div className="hairline-t px-4 py-3">{footer}</div>}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
