import { useEffect, useState, type FormEvent, type ReactElement } from "react";

import { apiClient } from "../api";
import type { SupportTicket } from "../api/models";
import { formatApiError } from "../lib/errors";
import { Button, Card, FormField, InlineNotice, TextInput } from "../ui";

function idempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.().replaceAll("-", "") ?? `${Date.now()}supportticket`;
}

export function SupportPage(): ReactElement {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    try {
      const status = await apiClient.getSupportStatus();
      setEnabled(status.enabled);
      setTickets(await apiClient.listSupportTickets());
      setError(null);
    } catch (caught: unknown) {
      setError(formatApiError(caught));
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const ticket = await apiClient.createSupportTicket({
        title: String(form.get("title")), body: String(form.get("body")),
        category: String(form.get("category")) as "other", idempotency_key: idempotencyKey(),
        environment: "web", app_version: import.meta.env.VITE_APP_VERSION ?? "",
      });
      setTickets((rows) => [ticket, ...rows]);
      setSelected(await apiClient.getSupportTicket(ticket.id));
      event.currentTarget.reset();
      setError(null);
    } catch (caught: unknown) { setError(formatApiError(caught)); }
    finally { setBusy(false); }
  }

  async function open(ticket: SupportTicket): Promise<void> {
    try { setSelected(await apiClient.getSupportTicket(ticket.id)); setError(null); }
    catch (caught: unknown) { setError(formatApiError(caught)); }
  }

  async function reply(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (selected === null) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await apiClient.replySupportTicket(selected.id, String(form.get("reply")));
      setSelected(await apiClient.getSupportTicket(selected.id));
      event.currentTarget.reset();
      setError(null);
    } catch (caught: unknown) { setError(formatApiError(caught)); }
    finally { setBusy(false); }
  }

  return <section className="support-layout" aria-label="Support tickets">
    <Card className="support-intro"><h1>Family Support</h1><p>Ask for help and follow the conversation without leaving Family Manager.</p></Card>
    {error ? <InlineNotice variant="error">{error}</InlineNotice> : null}
    {enabled === false ? <InlineNotice variant="info">Ticket support is prepared but not enabled yet.</InlineNotice> : null}
    <Card><h2>New ticket</h2><form className="form-grid" onSubmit={(event) => { void create(event); }}>
      <FormField label="Subject"><TextInput name="title" minLength={3} maxLength={200} required disabled={!enabled || busy} /></FormField>
      <FormField label="Category"><select name="category" defaultValue="other" disabled={!enabled || busy}><option value="account">Account</option><option value="chores">Chores</option><option value="homeschool">Homeschool</option><option value="recipes">Recipes</option><option value="billing">Billing</option><option value="bug">Bug</option><option value="feature">Feature request</option><option value="other">Other</option></select></FormField>
      <FormField label="What happened?"><textarea name="body" minLength={3} maxLength={10000} rows={6} required disabled={!enabled || busy} /></FormField>
      <Button type="submit" disabled={!enabled || busy}>{busy ? "Sending..." : "Open ticket"}</Button>
    </form></Card>
    <Card><h2>My tickets</h2>{tickets.length === 0 ? <p>No tickets yet.</p> : <ul className="support-ticket-list">{tickets.map((ticket) => <li key={ticket.id}><button type="button" onClick={() => { void open(ticket); }}><strong>#{ticket.ticket_number} · {ticket.title}</strong><span>{ticket.state}</span></button></li>)}</ul>}</Card>
    {selected ? <Card><h2>#{selected.ticket_number} · {selected.title}</h2><p>Status: {selected.state}</p><div className="support-thread">{selected.articles.map((article, index) => <article key={article.id ?? index}><p>{article.body}</p><small>{article.created_at}</small></article>)}</div><form className="form-grid" onSubmit={(event) => { void reply(event); }}><FormField label="Reply"><textarea name="reply" minLength={1} maxLength={10000} rows={4} required disabled={busy} /></FormField><Button type="submit" disabled={busy}>Send reply</Button></form></Card> : null}
  </section>;
}
