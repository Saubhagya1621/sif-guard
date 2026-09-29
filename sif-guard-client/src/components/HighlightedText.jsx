// Renders report text with the model's explanation spans (character offsets from /classify).
export default function HighlightedText({ text = "", phrases = [] }) {
  const spans = [...(phrases || [])]
    .filter((p) => Number.isInteger(p.start) && Number.isInteger(p.end) && p.end > p.start && p.end <= text.length)
    .sort((a, b) => a.start - b.start);
  const out = [];
  let cursor = 0;
  spans.forEach((p, i) => {
    if (p.start < cursor) return;
    if (p.start > cursor) out.push(<span key={`t${i}`}>{text.slice(cursor, p.start)}</span>);
    out.push(
      <mark
        key={`h${i}`}
        title={`Model attribution weight ${p.weight}`}
        className="bg-signal-danger/20 text-signal-danger rounded-[2px] px-0.5"
      >
        {text.slice(p.start, p.end)}
      </mark>,
    );
    cursor = p.end;
  });
  if (cursor < text.length) out.push(<span key="rest">{text.slice(cursor)}</span>);
  return <>{out}</>;
}
