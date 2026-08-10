"use client";

import { InstallPrompt } from "./install-prompt";

/** Registers SW and shows install CTA when Chrome offers it. */
export function InstallPromptHost() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 sm:bottom-6">
      <div className="pointer-events-auto">
        <InstallPrompt className="shadow-md" />
      </div>
    </div>
  );
}
