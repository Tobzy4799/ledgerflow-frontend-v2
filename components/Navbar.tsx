import Image from "next/image";

export function Navbar() {
  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur"
      style={{ background: "color-mix(in srgb, var(--bg) 85%, transparent)" }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Image
            src="/ledgerflow-logo.jpeg"
            alt="Ledgerflow"
            width={35}
            height={35}
            className="rounded-md"
          />
          <span className="font-semibold text-lg ">Ledgerflow</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#how-it-works" className="hover:text-(--text-primary)">
            How it works
          </a>
          <a
            href="https://github.com/Tobzy4799/ledgerflow"
            className="hover:text-(--text-primary)"
          >
            GitHub
          </a>
        </nav>
        <a
          href="/app"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--accent)" }}
        >
          Launch App
        </a>
      </div>
    </header>
  );
}
