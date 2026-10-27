import { FolderCode } from "lucide-react";

export default function IDEXIcon({ className = "size-12" }: { className?: string }) {
  return (
    <div
      className={`grid aspect-square place-items-center rounded-[22%] bg-indigo-800 ${className}`}
    >
      <FolderCode className="size-3/5 text-amber-300" />
    </div>
  );
}
