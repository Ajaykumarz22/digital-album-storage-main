import Link from "next/link";
import { type ReactNode } from "react";
import { formatBytes } from "@/lib/format";
import { archiveStatus } from "@/lib/archiveStatus";

export type ArchiveRow = {
  id: string;
  name: string;
  fileCount: number;
  sizeBytes: number;
  status: string;
  termYears: number;
};


// Shared Cold Drive listing, used by both the customer portal and the studio
// customer page. `browseBase` is the URL prefix for the per-archive detail page.
export default function ArchiveList({
  archives,
  browseBase,
  emptyHint,
  emptyAction,
}: {
  archives: ArchiveRow[];
  browseBase: string;
  emptyHint: string;
  emptyAction?: ReactNode;
}) {
  if (archives.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-black/15 p-6 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
        <p>{emptyHint}</p>
        {emptyAction && <div className="mt-4 flex justify-center">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Files</th>
            <th className="px-4 py-3 font-medium">Size</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Kept for</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {archives.map((a) => {
            const st = archiveStatus(a.status);
            return (
              <tr
                key={a.id}
                className="border-b border-black/5 last:border-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 font-medium">🧊 {a.name}</td>
                <td className="px-4 py-3">{a.fileCount}</td>
                <td className="px-4 py-3">{formatBytes(a.sizeBytes)}</td>
                <td className={`px-4 py-3 ${st.cls}`}>{st.label}</td>
                <td className="px-4 py-3">{a.termYears} years</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`${browseBase}/${a.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Browse
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
