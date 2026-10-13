import { Fragment, type ReactNode } from "react";

function inline(text: string): ReactNode[] {
  // Render a deliberately limited subset. Everything else (including HTML and
  // image syntax) stays escaped text; nothing embeds or fetches remote content.
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|(?<!!)\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`"))
        return <code key={index}>{part.slice(1, -1)}</code>;
      const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
      if (link)
        return (
          <a
            key={index}
            href={link[2]}
            rel="noopener noreferrer"
            target="_blank"
          >
            {link[1]}
          </a>
        );
      return <Fragment key={index}>{part}</Fragment>;
    });
}
export function SafeMarkdown({ text }: { text: string | null | undefined }) {
  return (
    <div className="family-tree-safe-text">
      {(text ?? "").split(/\n\s*\n/).map((paragraph, index) => {
        if (paragraph.startsWith("## "))
          return <h3 key={index}>{inline(paragraph.slice(3))}</h3>;
        if (paragraph.startsWith("# "))
          return <h3 key={index}>{inline(paragraph.slice(2))}</h3>;
        if (paragraph.split("\n").every((line) => line.startsWith("- ")))
          return (
            <ul key={index}>
              {paragraph.split("\n").map((line, i) => (
                <li key={i}>{inline(line.slice(2))}</li>
              ))}
            </ul>
          );
        return (
          <p
            key={index}
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {inline(paragraph)}
          </p>
        );
      })}
    </div>
  );
}
