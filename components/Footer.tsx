export function Footer() {
  return (
    <footer className="hairline border-t py-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 text-sm text-subtle md:flex-row">
        <span>Ledgerflow · built on Arc</span>
        <div className="flex gap-6">
          <a href="https://github.com/Tobzy4799/ledgerflow" className="hover:text-muted">
            GitHub
          </a>
          <a href="/app" className="hover:text-muted">
            Launch App
          </a>
        </div>
      </div>
    </footer>
  );
}
