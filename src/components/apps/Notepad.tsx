export default function Notepad() {
  return (
    <section className="flex h-full flex-col overflow-y-auto">
      <nav className="flex shrink-0 items-center gap-4 border-b-slate-950 px-2.5 py-1 text-xs text-foreground/80 select-none bg-slate-200/5">
        <span className="cursor-default">File</span>
        <span className="cursor-default">Edit</span>
        <span className="cursor-default">View</span>
        <span className="cursor-default">Format</span>
        <span className="cursor-default">Help</span>
      </nav>
      <textarea className="text-sm font-mono h-full w-full resize-none border-0 p-2 pt-2.5 outline-none focus:ring-0"
                style={{
                  border: "none",
                  outline: "none",
                  boxShadow: "none",
                }}
      />
    </section>
  );
}
