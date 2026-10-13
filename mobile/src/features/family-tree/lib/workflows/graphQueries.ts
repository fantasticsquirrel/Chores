import type * as FT from "@family-manager/family-api/models";
import type { TreeReadPort } from "./queryPort";
import { union } from "./state";
export class TreeGraphQueries {
  params: FT.FamilyTreeGraphParams = {};
  private generation = 0;
  constructor(private port: TreeReadPort) {}
  invalidate() {
    this.generation++;
  }
  archived(personId: number) {
    this.params = {
      ...this.params,
      collapsed_up_ids: this.params.collapsed_up_ids?.filter(
        (id) => id !== personId,
      ),
      collapsed_down_ids: this.params.collapsed_down_ids?.filter(
        (id) => id !== personId,
      ),
    };
    if (this.port.state().focusId === personId) {
      this.params = { ...this.params, focus_person_id: null };
      this.port.update({ focusId: null, graph: null });
    }
  }
  async focus(personId: number) {
    if (!this.port.readable() || this.port.state().busy) return;
    this.port.supersedeGraph();
    this.params = { ...this.params, focus_person_id: personId };
    const graph = this.port.state().graph;
    this.port.update({
      focusId: personId,
      graph: graph ? { ...graph, expansion_token: null } : null,
    });
    await this.loadGraph(false);
  }
  async setLens(params: FT.FamilyTreeGraphParams) {
    if (!this.port.readable() || this.port.state().busy) return;
    this.port.supersedeGraph();
    this.params = { ...params };
    const graph = this.port.state().graph;
    this.port.update({
      graph: graph ? { ...graph, expansion_token: null } : null,
    });
    await this.loadGraph(false);
  }
  async loadGraph(append = false) {
    if (!this.port.readable()) return;
    const epoch = this.port.epoch(),
      request = ++this.generation,
      old = this.port.state().graph;
    const valid = () => this.port.valid(epoch) && this.generation === request;
    if (append && !old?.expansion_token) return;
    this.port.update({ loading: true, error: null });
    try {
      const graph = await this.port.request("graph", "getFamilyTreeGraph", {
        ...this.params,
        focus_person_id: this.port.state().focusId,
        ...(append ? { expansion_token: old!.expansion_token } : {}),
      });
      if (!valid()) return;
      if (
        graph.graph_revision !== this.port.state().collection?.graph_revision ||
        (append && graph.graph_revision !== old?.graph_revision)
      )
        throw new Error("Graph revision changed. Refresh before expanding.");
      const next =
        append && old
          ? {
              ...graph,
              nodes: union(old.nodes, graph.nodes),
              edges: union(old.edges, graph.edges),
            }
          : graph;
      if (
        next.nodes.length > graph.projection_limits.hard_max_nodes ||
        next.edges.length > graph.projection_limits.hard_max_edges
      )
        throw new Error("Graph display limit reached. Choose a closer focus.");
      this.port.update({ graph: next });
    } catch (e) {
      if (valid()) await this.port.readError(e);
    } finally {
      if (valid()) this.port.update({ loading: false });
    }
  }
}
