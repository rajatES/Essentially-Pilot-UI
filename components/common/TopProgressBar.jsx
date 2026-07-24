"use client";

import { useEffect, useRef, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

// A thin indeterminate progress bar pinned to the top of the app — visible
// whenever any react-query fetch or mutation is in flight. This is the single
// biggest "the app is doing something" signal; it makes navigation and
// mutations feel responsive even when the network is slow.
//
// It ramps toward ~90% while work is pending (never reaching 100% so it can't
// "finish early"), then completes and fades once everything settles.
export default function TopProgressBar() {
  const busy = useIsFetching() + useIsMutating() > 0;
  const [progress, setProgress] = useState(0); // 0 = hidden
  const timer = useRef(null);

  useEffect(() => {
    clearInterval(timer.current);
    if (busy) {
      setProgress((p) => (p === 0 ? 12 : p));
      // Creep toward 90% with diminishing steps — classic "trickle" feel.
      timer.current = setInterval(() => {
        setProgress((p) => (p >= 90 ? p : p + Math.max(0.5, (90 - p) * 0.12)));
      }, 200);
    } else if (progress > 0) {
      // Snap to 100%, then fade out.
      setProgress(100);
      timer.current = setTimeout(() => setProgress(0), 350);
    }
    return () => clearInterval(timer.current);
  }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  if (progress === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
      <div
        className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.7)] transition-[width,opacity] duration-300 ease-out"
        style={{ width: `${progress}%`, opacity: progress === 100 ? 0 : 1 }}
      />
    </div>
  );
}
