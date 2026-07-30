import {
  PiggyBank,
  Landmark,
  ArrowLeftRight,
  Droplets,
  ArrowRightLeft,
  ShieldCheck,
  MessageSquareText,
  Clock,
  Umbrella,
} from "lucide-react";

const coreFeatures = [
  {
    icon: PiggyBank,
    label: "Earn",
    description: "Supply USDC, earn from borrowers in real time.",
  },
  {
    icon: Landmark,
    label: "Borrow",
    description: "Deposit EURC or cirBTC, borrow USDC against it.",
  },
  {
    icon: ArrowLeftRight,
    label: "Swap",
    description: "Trade at a live oracle price, never a pool ratio.",
  },
  {
    icon: Droplets,
    label: "Liquidity Pool",
    description: "Provide liquidity · the scarcer side earns a bonus.",
  },
  {
    icon: ArrowRightLeft,
    label: "Bridge",
    description: "Move USDC across seven chains, gas-free or gas-your-way.",
  },
];

const agentFeatures = [
  {
    icon: ShieldCheck,
    label: "Guardian",
    description: "Watches your position and repays before it's at risk.",
  },
  {
    icon: MessageSquareText,
    label: "Executor",
    description: "Say what you want in plain English. It handles the rest.",
  },
  {
    icon: Clock,
    label: "Conditional Agents",
    description: "Set a price target or a schedule. It trades without you.",
  },
  {
    icon: Umbrella,
    label: "Insurance Pool",
    description: "Every borrow quietly funds a safety net for lenders.",
  },
];

function Card({ icon: Icon, label, description }: { icon: React.ComponentType<{ size?: number }>; label: string; description: string }) {
  return (
    <div
      className="card reveal group p-6 transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg"
      style={{ borderColor: "var(--border)" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      <div className="transition-colors duration-200 group-hover:text-(--accent)">
        <Icon size={20} />
      </div>
      <h3 className="mt-4 text-base font-semibold">{label}</h3>
      <p className="mt-1.5 text-sm text-muted">{description}</p>
    </div>
  );
}

export function FeatureGrid() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20 md:py-28">
      <div className="reveal mb-4">
        <p className="text-sm font-medium tracking-wide text-muted uppercase">
          The lending layer
        </p>
        <h2 className="mt-2" style={{ fontSize: "var(--text-h2)" }}>
          One settlement engine, not five products.
        </h2>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {coreFeatures.map((f) => (
          <Card key={f.label} {...f} />
        ))}
      </div>

      <div className="reveal mt-20 mb-4">
        <p className="text-sm font-medium tracking-wide text-muted uppercase">
          The agent layer
        </p>
        <h2 className="mt-2" style={{ fontSize: "var(--text-h2)" }}>
          Agents that act on your behalf, within limits you set.
        </h2>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {agentFeatures.map((f) => (
          <Card key={f.label} {...f} />
        ))}
      </div>
    </section>
  );
}