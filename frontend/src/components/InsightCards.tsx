import type { InsightCard, InsightSeverity } from '../types/insightCards';

const SEVERITY_STYLES: Record<InsightSeverity, { border: string; badge: string; icon: string }> = {
  info: {
    border: 'border-accent/30',
    badge: 'bg-accent/10 text-accent',
    icon: '●',
  },
  warning: {
    border: 'border-yellow-500/40',
    badge: 'bg-yellow-500/10 text-yellow-400',
    icon: '▲',
  },
  critical: {
    border: 'border-danger/40',
    badge: 'bg-danger/10 text-danger',
    icon: '◆',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  payments: 'Payments',
  roster: 'Roster',
  controls: 'Controls',
  routing: 'Routing',
};

function SeverityBadge({ severity }: { severity: InsightSeverity }) {
  const style = SEVERITY_STYLES[severity];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] ${style.badge}`}>
      <span aria-hidden="true">{style.icon}</span>
      {severity}
    </span>
  );
}

function SingleCard({ card }: { card: InsightCard }) {
  const style = SEVERITY_STYLES[card.severity];
  return (
    <article
      className={`glass noise rounded-2xl border ${style.border} p-5 flex flex-col gap-3`}
      role="article"
      aria-label={card.title}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
          {CATEGORY_LABELS[card.category] ?? card.category}
        </span>
        <SeverityBadge severity={card.severity} />
      </div>

      <h3 className="text-lg font-bold text-text">{card.title}</h3>
      <p className="text-sm leading-relaxed text-muted">{card.summary}</p>

      <div className="mt-auto flex items-end justify-between pt-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
            {card.metricLabel}
          </p>
          <p className="text-2xl font-black text-text">{card.metric}</p>
        </div>
        <time
          className="text-[10px] text-muted"
          dateTime={card.generatedAt}
          title={card.generatedAt}
        >
          {new Date(card.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>
    </article>
  );
}

export interface InsightCardsProps {
  cards: InsightCard[];
  /** Optional heading above the grid. */
  heading?: string;
}

export default function InsightCards({ cards, heading }: InsightCardsProps) {
  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-hi bg-black/5 p-8 text-center" role="status">
        <p className="text-sm text-muted">No insights to display — all metrics are within normal range.</p>
      </div>
    );
  }

  return (
    <section aria-label={heading ?? 'Insight cards'}>
      {heading && (
        <h2 className="text-xl font-bold text-text mb-4">{heading}</h2>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <SingleCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}
