// Map an archive's internal status to a friendly label + Tailwind colour class.
export function archiveStatus(status: string): { label: string; cls: string } {
  switch (status) {
    case "paid":
    case "archiving":
      return { label: "Archiving…", cls: "text-amber-600" };
    case "archived":
      return { label: "Archived", cls: "text-black/60 dark:text-white/60" };
    case "restoring":
      return { label: "Restoring…", cls: "text-amber-600" };
    case "available":
      return { label: "Ready to download", cls: "text-green-600" };
    case "failed":
      return { label: "Failed", cls: "text-red-600" };
    default:
      return { label: status, cls: "text-black/60 dark:text-white/60" };
  }
}
