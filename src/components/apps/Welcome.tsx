export default function Welcome() {
  const year = new Date().getFullYear();

  return (
    <section className="flex h-full flex-col">
      <div className="flex flex-1 flex-col justify-center gap-4 px-8 py-6">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Welcome to <span className="text-violet-300">ZytrOS</span>!
        </h1>

        <p className="text-sm leading-7 text-white">
          This is my playground for making small web games. I plan to build anything from
          2-player Battleship or Tic Tac Toe against an AI to the idiot virus remake (sandboxed).
        </p>

        <p className="text-sm leading-7 text-white">
          Click on an app icon to try one out. Have fun!
        </p>
      </div>

      <footer className="border-t border-white/10 px-8 py-3 text-xs text-slate-400">
        &copy; Zytronium {year}; All rights reserved.
      </footer>
    </section>
  );
}
