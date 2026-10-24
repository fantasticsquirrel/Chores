import { Button, InlineNotice } from "../../../ui";

type Props = {
  title: string;
  manage: boolean;
  online: boolean;
  checking: boolean;
  busy: boolean;
  announcement: string;
  mode: "tree" | "people";
  query: string;
  onModeChange: (mode: "tree" | "people") => void;
  onQueryChange: (query: string) => void;
};

export function TreeWorkspaceHeader({ title, manage, online, checking, busy, announcement, mode, query, onModeChange, onQueryChange }: Props) {
  return <header>
    <h1>{title}</h1>
    <p>Private household records. Relationships and uncertainty are recorded explicitly, never inferred.</p>
    {!manage ? <InlineNotice variant="info">View-only access. Management controls are unavailable.</InlineNotice> : null}
    {!online ? <InlineNotice variant="info">
      Offline: showing only this session&apos;s last authorized data. Remote changes or revocation cannot be checked until access refresh succeeds. Editing is disabled.
    </InlineNotice> : null}
    <p role="status">{checking ? "Rechecking authoritative access; reads and edits are paused. Your draft is kept until access is confirmed." : announcement}</p>
    <nav className="quick-actions" aria-label="Family Tree views">
      <Button className="family-tree-control" aria-pressed={mode === "tree"} onClick={() => onModeChange("tree")}>Tree</Button>
      <Button className="family-tree-control" aria-pressed={mode === "people"} onClick={() => onModeChange("people")}>People</Button>
    </nav>
    <label>Search names and aliases
      <input value={query} disabled={busy} onChange={(event) => { onQueryChange(event.target.value); onModeChange("people"); }} />
    </label>
  </header>;
}
