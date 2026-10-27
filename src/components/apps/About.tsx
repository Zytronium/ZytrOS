import { FaGithub } from "react-icons/fa";

export default function About() {
  return (
    <section className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-violet-400/20 px-6 py-5">
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          <span className="text-violet-300">About ZytrOS</span>
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          ZytrOS is a web-based simulated desktop and my personal playground
          for experimenting with small web apps and games. Every app on the
          desktop runs in its own fake window.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          ZytrOS is not a real operating system, virtual machine, remote desktop,
          or anything similar. It&apos;s just a website that looks like one.
        </p>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          This website is built and maintained by me, Zytronium. Apps are added
          whenever I get a new idea, so check back for new ones every now and then.
        </p>
      </div>

      <footer className="flex items-center gap-4 border-t border-white/10 px-6 py-4">
        Check out the open-source GitHub repo for this project:
        <a
          href="https://github.com/zytronium/ZytrOS"
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-400 transition-colors hover:text-violet-300"
        >
          <FaGithub className="h-5 w-5" />
          <span className="sr-only">Click here for GitHub repo</span>
        </a>
      </footer>
    </section>
  );
}
