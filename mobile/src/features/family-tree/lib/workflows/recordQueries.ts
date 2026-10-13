import type * as FT from "@family-manager/family-api/models";
import type { TreeReadPort } from "./queryPort";
import { union, type TreeState } from "./state";
export class TreeRecordQueries {
  private candidateRequest = 0;
  private candidateFilters: FT.FamilyTreePeopleParams = {
    limit: 30,
    archived: false,
  };
  constructor(private port: TreeReadPort) {}
  async searchCandidates(query: string) {
    if (!this.port.readable()) return;
    const epoch = this.port.epoch(),
      selection = this.port.selection(),
      request = ++this.candidateRequest;
    this.candidateFilters = { query, archived: false, limit: 30 };
    this.port.update({ loading: true, error: null });
    const current = () =>
      this.port.valid(epoch) &&
      selection === this.port.selection() &&
      request === this.candidateRequest;
    try {
      const page = await this.port.request(
        "candidates",
        "listFamilyTreePeople",
        this.candidateFilters,
      );
      if (!current()) return;
      if (page.graph_revision !== this.port.state().collection?.graph_revision)
        throw new Error(
          "Candidate revision changed. Refresh before choosing a person.",
        );
      this.port.update({ candidatePeople: page });
    } catch (e) {
      if (current()) await this.port.readError(e);
    } finally {
      if (current()) this.port.update({ loading: false });
    }
  }
  async moreCandidates() {
    return this.more("candidatePeople");
  }
  async morePeople() {
    return this.more("people");
  }
  async moreStories() {
    return this.more("stories");
  }
  async moreResidences() {
    return this.more("residences");
  }
  private async more(
    kind: "people" | "candidatePeople" | "stories" | "residences",
  ) {
    if (!this.port.readable() || this.port.state().loading) return;
    const page = this.port.state()[kind],
      epoch = this.port.epoch(),
      selection = this.port.selection(),
      candidateRequest = this.candidateRequest,
      id = this.port.state().selectedId;
    if (!page?.next_cursor) return;
    const current = () =>
      this.port.valid(epoch) &&
      (kind === "people" || selection === this.port.selection()) &&
      (kind !== "candidatePeople" ||
        candidateRequest === this.candidateRequest);
    this.port.update({ loading: true, error: null });
    try {
      const next =
        kind === "people" || kind === "candidatePeople"
          ? await this.port.request(
              kind === "people" ? "people" : "candidates",
              "listFamilyTreePeople",
              {
                ...(kind === "people"
                  ? this.port.directoryFilters()
                  : this.candidateFilters),
                cursor: page.next_cursor,
              },
            )
          : kind === "stories"
            ? await this.port.request("stories", "listFamilyTreeStories", id!, {
                limit: 30,
                cursor: page.next_cursor,
              })
            : await this.port.request(
                "residences",
                "listFamilyTreeResidences",
                id!,
                {
                  limit: 30,
                  cursor: page.next_cursor,
                },
              );
      if (!current()) return;
      if (next.graph_revision !== page.graph_revision)
        throw new Error("Page revision changed. Refresh before loading more.");
      const items = union(
        page.items as Array<{ id: number }>,
        next.items as Array<{ id: number }>,
      );
      if (items.length > 300)
        throw new Error(
          "Display limit reached. Narrow the search or reopen this person.",
        );
      // Pages retain server ordering; only records from the same revision are unioned.
      this.port.update({ [kind]: { ...next, items } } as Partial<TreeState>);
    } catch (e) {
      if (current()) await this.port.readError(e);
    } finally {
      if (current()) this.port.update({ loading: false });
    }
  }
  async compareWith(otherId: number) {
    const selectedId = this.port.state().selectedId;
    if (!this.port.readable() || selectedId === null) return;
    const epoch = this.port.epoch(),
      selection = this.port.selection();
    this.port.update({ loading: true, error: null, compare: null });
    try {
      const compare = await this.port.request(
        "compare",
        "compareFamilyTreePeople",
        {
          person_a_id: selectedId,
          person_b_id: otherId,
          include_history: this.port.graphParams().include_history,
        },
      );
      if (this.port.valid(epoch) && selection === this.port.selection())
        this.port.update({ compare });
    } catch (e) {
      if (this.port.valid(epoch)) await this.port.readError(e);
    } finally {
      if (this.port.valid(epoch)) this.port.update({ loading: false });
    }
  }
  async identities() {
    if (!this.port.readable() || this.port.state().access !== "manage") return;
    const epoch = this.port.epoch(),
      selection = this.port.selection();
    this.port.update({ loading: true, error: null });
    try {
      const candidates = await this.port.request(
        "identities",
        "listFamilyTreeIdentityCandidates",
      );
      if (this.port.valid(epoch) && selection === this.port.selection())
        this.port.update({ candidates: candidates.items });
    } catch (e) {
      if (this.port.valid(epoch)) await this.port.readError(e);
    } finally {
      if (this.port.valid(epoch)) this.port.update({ loading: false });
    }
  }
}
