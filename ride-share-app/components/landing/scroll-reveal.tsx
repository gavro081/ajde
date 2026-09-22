"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./landing.module.css";

export function ScrollReveal({ children, className }: { children: ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-reveal-state", "visible");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -64px 0px", threshold: 0 });

    container.querySelectorAll(`.${styles.reveal}`).forEach((section) => {
      // Observe the content itself, not the section's large empty top padding.
      const items = section.querySelectorAll<HTMLElement>(
        ":scope > :not(ul):not(ol), :scope > ul > li, :scope > ol > li",
      );
      items.forEach((item) => {
        if (item.dataset.revealState === "visible") return;
        // Keep content already on screen visible during hydration or scroll restoration.
        if (item.getBoundingClientRect().top < window.innerHeight) {
          item.dataset.revealState = "visible";
          return;
        }
        if (item.parentElement?.matches("ul, ol")) {
          const index = Array.from(item.parentElement.children).indexOf(item);
          item.style.setProperty("--reveal-delay", `${Math.min(index, 2) * 45}ms`);
        }
        item.dataset.revealState = "pending";
        observer.observe(item);
      });
    });

    return () => observer.disconnect();
  }, []);

  return <div ref={containerRef} className={className}>{children}</div>;
}
