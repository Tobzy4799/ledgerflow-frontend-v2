export function Hero() {
  return (
    <section className="pt-10 pb-20 md:pt-10 md:pb-28">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <p className="reveal mb-5 text-sm font-medium tracking-wide text-muted uppercase">
          Stablecoin-native · Built on Arc
        </p>
        <h1
          className="reveal mx-auto max-w-4xl font-semibold"
          style={{ fontSize: "var(--text-hero)" }}
        >
          Money that moves and settles itself.
        </h1>
        <p className="reveal mx-auto mt-6 max-w-2xl text-lg text-muted">
          Lending, swaps, liquidity, and a layer of autonomous agents that watch,
          repay, and trade on your behalf, all in one settlement engine, entirely in
          USDC.
        </p>
        <div className="reveal mt-10 flex items-center justify-center gap-4">
          <a
            href="/app"
            className="rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
            style={{ background: "var(--accent)" }}
          >
            Launch App
          </a>
          <a
            href="#how-it-works"
            className="rounded-lg border px-6 py-3 text-sm font-semibold text-muted transition-all duration-200 ease-out hover:-translate-y-0.5"
            style={{ borderColor: "var(--border-strong)" }}
          >
            See how it works
          </a>
        </div>
      </div>
    </section>
  );
}