export default function WelcomeIcon({ className = "size-12" }: { className?: string }) {
  return (
    <div
      className={`grid aspect-square overflow-hidden rounded-[22%] ${className}`}
    >
      <img
        src="/icon.png"
        alt=""
        aria-hidden
        draggable={false}
        className="size-8/10 m-auto"
      />
    </div>
  );
}
