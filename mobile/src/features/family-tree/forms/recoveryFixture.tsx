import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { apiClient } from "../../../api/client";
import { FamilyTreeScreen } from "../../../screens/FamilyTreeScreen";
import type * as FT from "@family-manager/family-api/models";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
const mockWrites: Uint8Array[] = [];
const mockDeletes: string[] = [];
jest.mock("expo-file-system", () => {
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts
        .map((p) => (typeof p === "string" ? p : p.uri))
        .join("/")
        .replace(/\/+/g, "/")
        .replace("file:/", "file:///");
    }
    exists = true;
    create() {}
    delete() {
      mockDeletes.push(this.uri);
    }
  }
  class File extends Directory {
    size = 5;
    async copy(_destination: File) {}
    write(bytes: Uint8Array) {
      mockWrites.push(bytes);
    }
  }
  return { File, Directory, Paths: { cache: { uri: "file:///cache" } } };
});
import * as imagePicker from "expo-image-picker";
import * as documentPicker from "expo-document-picker";
import * as sharing from "expo-sharing";
const originalFormData = global.FormData;
const NativeFormData = jest.requireActual<{ default: typeof FormData }>(
  "react-native/Libraries/Network/FormData",
).default;
jest.setTimeout(15000);
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
const session: FT.AuthSessionResponse = {
  user: {
    id: 1,
    household_id: 27,
    email: "qa@example.test",
    role: "PARENT",
    is_household_owner: false,
  },
};
const grant: FT.FamilyModule = {
  key: "family-tree",
  name: "Family Tree",
  description: "History",
  can_manage: true,
};
let revision = 2;
const person: FT.FamilyTreePerson = {
  id: 3,
  display_name: "Ada",
  first_name: null,
  middle_name: null,
  last_name: null,
  maiden_name: null,
  suffix: null,
  aliases: [],
  gender: null,
  living_status: "unknown",
  birth_date: null,
  death_date: null,
  birth_place: null,
  death_place: null,
  birth_source: null,
  death_source: null,
  notes_md: null,
  source_label: null,
  source_url: null,
  tags: [],
  created_by_user_id: 1,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  is_locked: false,
  lock_reason: null,
  locked_by_user_id: null,
  locked_at: null,
  archived_at: null,
  merged_into_person_id: null,
  primary_image_asset_id: null,
};
const target = { ...person, id: 4, display_name: "Ada" };
const job = (
  kind: string,
  summary: Record<string, unknown>,
): FT.FamilyTreePreview => ({
  id: 9,
  kind,
  state: "ready",
  expected_graph_revision: revision,
  expires_at: "2099-01-01T00:00:00Z",
  summary,
  preview_token: "token",
});
const mergeSummary = {
  source: person,
  target,
  conflicting_fields: ["display_name"],
  unresolved_fields: [],
  relationship_changes: [],
  retained_records: {
    stories: 1,
    residences: 0,
    tags: 0,
    names: 0,
    media_references: 0,
  },
  retargeted_alias_ids: [8],
  similar_partner_episode_ids: [10],
  requires_partner_review: false,
  warnings: [],
};
const importSummary = {
  people: 1,
  relationships: 0,
  stories: 1,
  residences: 0,
  media: 0,
  missing_media: 1,
  warnings: ["chronology_review"],
  duplicate_provenance: true,
  duplicate_suggestions: [{ source_key: "p1", candidate_person_ids: [4] }],
  unsupported_fields: ["hint"],
};
const options = expect.objectContaining({ signal: expect.any(AbortSignal) });
function setup() {
  revision = 2;
  jest.spyOn(apiClient, "getMyModules").mockResolvedValue({ modules: [grant] });
  jest
    .spyOn(apiClient, "getFamilyTreeCollection")
    .mockImplementation(async () => ({
      state: "initialized",
      collection_id: 1,
      title: "Tree",
      graph_revision: revision,
      default_focus_person_id: null,
      active_people_count: 2,
      archived_people_count: 0,
      capabilities: { can_manage: true, can_export: true, can_purge: true },
    }));
  jest
    .spyOn(apiClient, "listFamilyTreePeople")
    .mockImplementation(async () => ({
      graph_revision: revision,
      items: [person, target],
      total: 2,
      next_cursor: null,
    }));
  jest.spyOn(apiClient, "getFamilyTreeGraph").mockImplementation(async () => ({
    graph_revision: revision,
    focus_person_id: null,
    nodes: [],
    edges: [],
    truncated: false,
    expansion_token: null,
    warnings: [],
    projection_limits: {
      max_nodes: 250,
      max_edges: 500,
      hard_max_nodes: 500,
      hard_max_edges: 1000,
    },
  }));
  jest
    .spyOn(apiClient, "getFamilyTreePerson")
    .mockImplementation(async (id) => ({
      graph_revision: revision,
      person: id === 4 ? target : person,
      canonical_person: null,
      parent_links: [],
      care_links: [],
      partner_episodes: [],
      identity_link: null,
    }));
  jest
    .spyOn(apiClient, "listFamilyTreeStories")
    .mockImplementation(async () => ({
      graph_revision: revision,
      items: [],
      next_cursor: null,
    }));
  jest
    .spyOn(apiClient, "listFamilyTreeResidences")
    .mockImplementation(async () => ({
      graph_revision: revision,
      items: [],
      next_cursor: null,
    }));
  jest.spyOn(apiClient, "listFamilyTreeMediaReferences").mockResolvedValue([]);
}
export let mounted: ReturnType<typeof render>;
function mount() {
  mounted = render(
    <FamilyTreeScreen
      session={session}
      modules={[]}
      onModulesLoaded={() => {}}
    />,
  );
  return mounted;
}
async function open() {
  mount();
  fireEvent.press(
    await screen.findByLabelText("Open Ada (#3)", {}, { timeout: 5000 }),
  );
  await screen.findByText("Stories");
}
const commit = async (): Promise<FT.FamilyTreeMutationResult> => ({
  committed_revision: ++revision,
  current_revision: revision,
  replayed: false,
  affected: {
    person_ids: [3, 4],
    relationship_ids: [],
    story_ids: [],
    residence_ids: [],
    identity_link_ids: [],
    media_asset_ids: [],
    media_reference_ids: [],
  },
  warnings: [],
});
beforeEach(() => {
  setup();
  global.FormData = NativeFormData;
  mockWrites.length = 0;
  mockDeletes.length = 0;
});
afterEach(() => {
  global.FormData = originalFormData;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

export function setRevision(value: number) {
  revision = value;
}
export {
  apiClient,
  imagePicker,
  documentPicker,
  mount,
  open,
  job,
  mergeSummary,
  importSummary,
  commit,
  session,
  grant,
};
