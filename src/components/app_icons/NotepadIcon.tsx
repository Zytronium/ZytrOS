import { NotepadText } from "lucide-react";

export default function NotepadIcon({ className = "size-12" }: { className?: string }) {
  return (
    <div
      className={`grid aspect-square place-items-center rounded-[22%] bg-sky-600 ${className}`}
    >
      <NotepadText className="size-3/5 text-slate-50" />
    </div>
  );
}
