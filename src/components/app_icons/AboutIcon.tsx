import { BadgeInfo } from "lucide-react";

export default function AboutIcon({ className = "size-12" }: { className?: string }) {
  return (
    <div
      className={`grid aspect-square place-items-center rounded-[22%] bg-violet-600 ${className}`}
    >
      <BadgeInfo className="size-3/5 text-slate-50" />
    </div>
  );
}
