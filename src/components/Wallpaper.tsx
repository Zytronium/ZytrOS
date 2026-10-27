import Image from "next/image";

// Full-screen wallpaper from wallpaper.jpg
export default function Wallpaper({ onPointerDown }: { onPointerDown?: () => void }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-base" aria-hidden onPointerDown={onPointerDown}>
      <Image
        src="/images/wallpaper.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        draggable={false}
        className="object-cover"
      />
    </div>
  );
}
