import Link from "next/link";

export default function Breadcrumbs({ items }) {
  return (
    <nav style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
      {items.map((it, i) => (
        <span key={i}>
          {i > 0 && <span style={{ margin: "0 6px" }}>&rsaquo;</span>}
          {it.href ? (
            <Link href={it.href} style={{ color: "var(--muted)", textDecoration: "none" }}>
              {it.label}
            </Link>
          ) : (
            <span style={{ color: "var(--text)", fontWeight: 600 }}>{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
