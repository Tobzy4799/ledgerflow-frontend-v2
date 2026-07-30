const usingProtocol = [
  { n: "01", title: "Connect your wallet", detail: "Any EVM wallet. No account, no forms." },
  { n: "02", title: "Bring in USDC", detail: "Bridge from any of 7 chains, or already have it on Arc." },
  { n: "03", title: "Supply, borrow, or swap", detail: "Every action settles onchain, in USDC, immediately." },
];

const activatingAgent = [
  { n: "01", title: "Choose an agent", detail: "Guardian for protection, Executor for plain-English commands, or your own conditional rule." },
  { n: "02", title: "Set your limits", detail: "Max per action, max per day. The agent can never exceed what you set." },
  { n: "03", title: "Approve a standing balance", detail: "One USDC approval, shared across every agent you activate." },
  { n: "04", title: "It runs on its own", detail: "Checks, repays, or trades, until you revoke it." },
];

function Rail({ eyebrow, title, steps }: { eyebrow: string; title: string; steps: { n: string; title: string; detail: string }[] }) {
  return (
    <div className="reveal">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-semibold">{title}</h3>
      <ol className="mt-8 space-y-8">
        {steps.map((step, i) => (
          <li key={step.n} className="reveal flex gap-5" style={{ transitionDelay: `${i * 100}ms` }}>
            <span className="font-data text-sm text-subtle">{step.n}</span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="mt-1 text-sm text-muted">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function HowItWorksRail() {
  return (
    <section id="how-it-works" className="hairline border-t py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="reveal" style={{ fontSize: "var(--text-h2)" }}>
          Two ways to get moving.
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-16 md:grid-cols-2">
          <Rail eyebrow="Using the protocol" title="Supply, borrow, swap" steps={usingProtocol} />
          <Rail eyebrow="The agent layer" title="Set it up once, it runs itself" steps={activatingAgent} />
        </div>
      </div>
    </section>
  );
}