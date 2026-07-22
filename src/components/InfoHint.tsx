// A small "ⓘ" icon that reveals help text on hover or keyboard focus. Pure CSS
// (no client JS) — safe to use inside server components. Sits next to a title.
export default function InfoHint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label="More info"
        className="flex items-center justify-center text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-6 z-30 hidden w-64 rounded-md border border-black/10 bg-white p-2 text-left text-xs font-normal leading-snug text-black/70 shadow-lg group-hover:block group-focus-within:block dark:border-white/15 dark:bg-neutral-900 dark:text-white/70"
      >
        {text}
      </span>
    </span>
  );
}
