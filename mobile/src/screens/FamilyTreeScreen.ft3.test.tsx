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
import { apiClient } from "../api/client";
import { FamilyTreeScreen } from "./FamilyTreeScreen";
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
    constructor(...parts: any[]) {
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
const person = {
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
} as FT.FamilyTreePerson;
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
function mount() {
  return render(
    <FamilyTreeScreen
      session={session}
      modules={[]}
      onModulesLoaded={() => {}}
    />,
  );
}
async function open() {
  mount();
  fireEvent.press(await screen.findByRole("button", { name: "People" }));
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
describe("FT3 actual native screen composition", () => {
  it("reviews original and replacement identity associations before reapplying an unlink conflict", async () => {
    const oldLink = {
      id: 10,
      person_id: 3,
      user_id: 21,
      child_id: null,
      label: "Original adult",
      active: true,
    };
    const newLink = {
      id: 11,
      person_id: 3,
      user_id: null,
      child_id: 22,
      label: "Replacement child",
      active: true,
    };
    jest
      .mocked(apiClient.getFamilyTreePerson)
      .mockImplementation(async () => ({
        graph_revision: revision,
        person,
        canonical_person: null,
        parent_links: [],
        care_links: [],
        partner_episodes: [],
        identity_link: revision === 2 ? oldLink : newLink,
      }));
    const unlink = jest
      .spyOn(apiClient, "unlinkFamilyTreeIdentity")
      .mockRejectedValueOnce(
        Object.assign(new Error("Association changed"), {
          code: "revision_conflict",
          status: 409,
        }),
      )
      .mockImplementationOnce(commit);
    await open();
    fireEvent.press(screen.getByText("Unlink identity from Ada"));
    fireEvent.press(screen.getByText("Confirm Unlink identity from Ada"));
    await screen.findByText("Association changed");
    revision = 3;
    fireEvent.press(screen.getByText("Review latest revision"));
    await screen.findByText(
      /Latest association: id=11.*kind=child.*child_id=22.*Replacement child.*active=true/,
    );
    expect(
      screen.getByText(
        /Original association: id=10.*kind=user.*user_id=21.*Original adult.*active=true/,
      ),
    ).toBeTruthy();
    expect(unlink).toHaveBeenCalledTimes(1);
    const first = unlink.mock.calls[0][1];
    fireEvent.press(screen.getByText("Reapply reviewed draft"));
    await waitFor(() => expect(unlink).toHaveBeenCalledTimes(2));
    expect(unlink.mock.calls[1][1].expected_graph_revision).toBe(3);
    expect(unlink.mock.calls[1][1].idempotency_key).not.toBe(
      first.idempotency_key,
    );
  });

  it("runs the enabled stale-preview unknown purge retry with the newly entered password and frozen facts", async () => {
    jest
      .spyOn(apiClient, "previewFamilyTreePurge")
      .mockResolvedValue(
        job("purge", {
          person_id: 3,
          alias_only: false,
          retained_backup_policy: "Backup policy",
          stories: 0,
          residences: 0,
          media_references: 0,
        }),
      );
    const mutation = jest
      .spyOn(apiClient, "commitFamilyTreePurge")
      .mockRejectedValueOnce(new Error("Unknown outcome"))
      .mockImplementationOnce(commit);
    await open();
    fireEvent.press(screen.getByText("Permanent purge"));
    fireEvent.changeText(
      screen.getByLabelText("Fresh password"),
      "old password",
    );
    fireEvent.press(screen.getByText("Preview purge"));
    await screen.findByText("Backup policy");
    fireEvent.changeText(
      screen.getByLabelText("Fresh password"),
      "old password",
    );
    fireEvent.press(screen.getByLabelText("Confirm permanent purge of #3"));
    fireEvent.press(screen.getByText("Commit purge"));
    await screen.findByText("Unknown outcome");
    const original = mutation.mock.calls[0][1];
    expect(screen.getByLabelText("Fresh password").props.value).toBe("");
    revision = 3;
    fireEvent.press(screen.getByText("Refresh"));
    await waitFor(() =>
      expect(apiClient.getFamilyTreePerson).toHaveBeenCalledTimes(2),
    );
    fireEvent.changeText(
      screen.getByLabelText("Fresh password"),
      "new password",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Retry original purge" }).props
          .accessibilityState.disabled,
      ).toBe(false),
    );
    fireEvent.press(screen.getByText("Retry original purge"));
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(2));
    expect(mutation.mock.calls[1][1]).toEqual({
      ...original,
      password: "new password",
    });
  });

  it("submits a dirty person draft from its original snapshot after collection/access refresh, then requires explicit conflict review", async () => {
    const mutation = jest
      .spyOn(apiClient, "patchFamilyTreePerson")
      .mockRejectedValue(
        Object.assign(new Error("Review latest fields"), {
          status: 409,
          code: "revision_conflict",
        }),
      );
    await open();
    fireEvent.press(screen.getByText("Edit person"));
    fireEvent.changeText(screen.getByLabelText("First name"), "My stale draft");
    revision = 3;
    jest
      .mocked(apiClient.getFamilyTreePerson)
      .mockImplementation(async () => ({
        graph_revision: revision,
        person: { ...person, first_name: "Other adult's new value" },
        canonical_person: null,
        parent_links: [],
        care_links: [],
        partner_episodes: [],
        identity_link: null,
      }));
    fireEvent.press(screen.getByText("Refresh"));
    await waitFor(() =>
      expect(apiClient.getFamilyTreePerson).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save changes" }).props
          .accessibilityState.disabled,
      ).toBe(false),
    );
    fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(mutation).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        expected_graph_revision: 2,
        changes: { first_name: "My stale draft" },
      }),
      options,
    );
    expect(screen.getByLabelText("First name").props.value).toBe(
      "My stale draft",
    );
  });

  it("keeps core and advanced sibling component identities distinct without duplicate-key warnings", async () => {
    const errors = jest.spyOn(console, "error").mockImplementation(() => {});
    await open();
    expect(
      errors.mock.calls.filter((args) => String(args[0]).includes("same key")),
    ).toEqual([]);
  });

  it("picks a real native photograph URI part, stages once, retries exact primary attachment, views authorized bytes and removes reference", async () => {
    jest.mocked(imagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///cache/ImagePicker/photo.png",
          width: 1,
          height: 1,
          mimeType: "image/png",
          fileSize: 5,
        },
      ],
    });
    const asset = {
      id: 11,
      mime_type: "image/png",
      byte_size: 5,
      width: 1,
      height: 1,
      checksum: "sum",
      caption: "Caption",
      state: "ready",
    };
    const ref = {
      id: 12,
      asset_id: 11,
      person_id: 3,
      story_id: null,
      role: "primary",
      asset,
    };
    const upload = jest
      .spyOn(apiClient, "uploadFamilyTreeMedia")
      .mockResolvedValue(asset);
    const attach = jest
      .spyOn(apiClient, "attachFamilyTreeMedia")
      .mockRejectedValueOnce(new Error("Network interrupted"))
      .mockImplementationOnce(commit);
    jest
      .mocked(apiClient.listFamilyTreeMediaReferences)
      .mockResolvedValue([ref]);
    const read = jest
      .spyOn(apiClient, "getFamilyTreeMediaContent")
      .mockResolvedValue({
        bytes: new Uint8Array([1, 2, 3]).buffer,
        content_type: "image/png",
        filename: null,
      });
    const remove = jest
      .spyOn(apiClient, "removeFamilyTreeMediaReference")
      .mockImplementation(commit);
    await open();
    fireEvent.press(screen.getByText("Photographs"));
    await screen.findByText("Choose photograph");
    fireEvent.press(screen.getByText("Choose photograph"));
    await waitFor(() =>
      expect(imagePicker.launchImageLibraryAsync).toHaveBeenCalled(),
    );
    fireEvent.changeText(
      screen.getByLabelText("Photograph caption"),
      "Caption",
    );
    fireEvent.press(screen.getByLabelText("Photograph role: primary"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Upload and attach photograph" })
          .props.accessibilityState.disabled,
      ).toBe(false),
    );
    fireEvent.press(screen.getByText("Upload and attach photograph"));
    await screen.findByText("Network interrupted");
    const body = attach.mock.calls[0][1];
    expect((upload.mock.calls[0][0] as any).getParts()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uri: expect.stringContaining("family-tree-"),
          name: "photograph.png",
          type: "image/png",
        }),
        expect.objectContaining({ fieldName: "caption", string: "Caption" }),
      ]),
    );
    expect(mockDeletes).toContain("file:///cache/ImagePicker/photo.png");
    fireEvent.press(screen.getByText("Retry original photograph attachment"));
    await waitFor(() => expect(attach).toHaveBeenCalledTimes(2));
    expect(attach.mock.calls[1][1]).toBe(body);
    expect(upload).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "View photograph #11" }).props
          .accessibilityState.disabled,
      ).toBe(false),
    );
    fireEvent.press(screen.getByText("View photograph #11"));
    await screen.findByLabelText("Authorized family photograph");
    expect(read).toHaveBeenCalledWith(11, options);
    expect(mockWrites).toEqual([]);
    fireEvent.press(screen.getByText("Hide photograph"));
    fireEvent.press(screen.getByText("Remove photograph reference #12"));
    fireEvent.press(
      screen.getByLabelText("Confirm remove reference #12 from #3"),
    );
    fireEvent.press(screen.getByText("Confirm reference removal"));
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith(
        11,
        12,
        expect.objectContaining({
          expected_graph_revision: 3,
          idempotency_key: expect.any(String),
        }),
        options,
      ),
    );
  });
  it("stages a picker JSON/ZIP, presents complete preview, acknowledges provenance and retries the unchanged append commit", async () => {
    jest.mocked(documentPicker.getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "content://documents/package",
          name: "personal.zip",
          size: 5,
          lastModified: 0,
          mimeType: "application/zip",
        },
      ],
    });
    const stage = jest
      .spyOn(apiClient, "stageFamilyTreeImport")
      .mockResolvedValue(job("import", importSummary));
    const poll = jest
      .spyOn(apiClient, "getFamilyTreeImportJob")
      .mockResolvedValue(job("import", importSummary));
    const mutation = jest
      .spyOn(apiClient, "commitFamilyTreeImport")
      .mockRejectedValueOnce(new Error("Network interrupted"))
      .mockImplementationOnce(commit);
    mount();
    fireEvent.press(
      await screen.findByText("Import / export", {}, { timeout: 5000 }),
    );
    fireEvent.press(screen.getByText("Choose JSON / ZIP append import"));
    await screen.findByText("Upload and stage append import");
    fireEvent.press(screen.getByText("Upload and stage append import"));
    await screen.findByText("Missing media: 1");
    expect(screen.getByText("Warning: chronology_review")).toBeTruthy();
    expect(screen.getByText("Unsupported fields: hint")).toBeTruthy();
    expect(screen.getByText("Duplicate suggestion p1: #4")).toBeTruthy();
    expect((stage.mock.calls[0][0] as any).getParts()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "family-tree.zip",
          type: "application/zip",
        }),
        expect.objectContaining({
          fieldName: "expected_graph_revision",
          string: "2",
        }),
      ]),
    );
    fireEvent.press(screen.getByText("Refresh import status"));
    await waitFor(() => expect(poll).toHaveBeenCalledWith(9, options));
    fireEvent.press(
      screen.getByLabelText(
        "Confirm reviewed append import #9, including warnings and missing media",
      ),
    );
    fireEvent.press(screen.getByText("Commit append import"));
    expect(mutation).not.toHaveBeenCalled();
    fireEvent.press(
      screen.getByLabelText("Acknowledge duplicate import provenance"),
    );
    fireEvent.press(screen.getByText("Commit append import"));
    await screen.findByText("Network interrupted");
    const body = mutation.mock.calls[0][1];
    expect(body).toMatchObject({
      confirmed: true,
      acknowledge_duplicate_provenance: true,
      expected_graph_revision: 2,
      reviewed_warnings: ["chronology_review"],
      idempotency_key: expect.any(String),
    });
    fireEvent.press(screen.getByText("Retry original append import"));
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(2));
    expect(mutation.mock.calls[1][1]).toBe(body);
    await waitFor(() =>
      expect(screen.queryByText("Missing media: 1")).toBeNull(),
    );
  });
  it("explicitly cancels a staged import through its actual no-body method", async () => {
    jest.mocked(documentPicker.getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "content://documents/package",
          name: "family.json",
          size: 5,
          lastModified: 0,
          mimeType: "application/json",
        },
      ],
    });
    jest
      .spyOn(apiClient, "stageFamilyTreeImport")
      .mockResolvedValue(job("import", importSummary));
    const cancel = jest
      .spyOn(apiClient, "cancelFamilyTreeImport")
      .mockResolvedValue({
        ...job("import", importSummary),
        state: "canceled",
      });
    mount();
    fireEvent.press(
      await screen.findByText("Import / export", {}, { timeout: 5000 }),
    );
    fireEvent.press(screen.getByText("Choose JSON / ZIP append import"));
    await screen.findByText("Upload and stage append import");
    fireEvent.press(screen.getByText("Upload and stage append import"));
    await screen.findByText("Missing media: 1");
    fireEvent.press(screen.getByText("Cancel staged append import"));
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Confirm cancel staged import"));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith(9, options));
    await waitFor(() =>
      expect(screen.queryByText("Missing media: 1")).toBeNull(),
    );
  });
  it("downloads real export ArrayBuffer bytes to an explicitly shared temporary file and cleans it", async () => {
    jest.mocked(sharing.isAvailableAsync).mockResolvedValue(true);
    jest.mocked(sharing.shareAsync).mockResolvedValue();
    jest.spyOn(apiClient, "createFamilyTreeExport").mockResolvedValue(
      job("export", {
        format: "zip",
        people: 2,
        media: 1,
        media_omitted: false,
      }),
    );
    const download = jest
      .spyOn(apiClient, "downloadFamilyTreeExport")
      .mockResolvedValue({
        bytes: new Uint8Array([1, 2, 255]).buffer,
        content_type: "application/zip",
        filename: "personal.zip",
      });
    mount();
    fireEvent.press(
      await screen.findByText("Import / export", {}, { timeout: 5000 }),
    );
    fireEvent.press(screen.getByText("Create ZIP export"));
    await screen.findByText("Media omitted: no");
    fireEvent.press(screen.getByText("Download and save / share export"));
    await waitFor(() => expect(sharing.shareAsync).toHaveBeenCalled());
    expect(download).toHaveBeenCalledWith(9, options);
    expect(mockWrites.map((x) => [...x])).toEqual([[1, 2, 255]]);
    expect(mockDeletes.some((x) => x.includes("family-tree-"))).toBe(true);
  });
  it("hides transfer/merge/purge and upload for authoritative view-only adults", async () => {
    jest
      .mocked(apiClient.getMyModules)
      .mockResolvedValue({ modules: [{ ...grant, can_manage: false }] });
    await open();
    expect(screen.queryByText("Import / export")).toBeNull();
    expect(screen.queryByText("Duplicate / merge")).toBeNull();
    expect(screen.queryByText("Permanent purge")).toBeNull();
    fireEvent.press(screen.getByText("Photographs"));
    await screen.findByText("Refresh photographs");
    expect(screen.queryByText("Choose photograph")).toBeNull();
    expect(apiClient.listFamilyTreeMediaReferences).toHaveBeenCalledWith(
      3,
      options,
    );
  });
  it("does not project owner purge from an administrator role without can_purge", async () => {
    jest.mocked(apiClient.getFamilyTreeCollection).mockResolvedValue({
      state: "initialized",
      collection_id: 1,
      title: "Tree",
      graph_revision: 2,
      default_focus_person_id: null,
      active_people_count: 2,
      archived_people_count: 0,
      capabilities: { can_manage: true, can_export: true, can_purge: false },
    });
    render(
      <FamilyTreeScreen
        session={{
          user: {
            ...session.user,
            role: "PARENT_ADMIN",
            is_household_owner: true,
          },
        }}
        modules={[]}
        onModulesLoaded={() => {}}
      />,
    );
    fireEvent.press(await screen.findByRole("button", { name: "People" }));
    fireEvent.press(
      await screen.findByLabelText("Open Ada (#3)", {}, { timeout: 5000 }),
    );
    await screen.findByText("Photographs");
    expect(screen.queryByText("Permanent purge")).toBeNull();
  });

  it("offers managed photographs with a native picker, not a URI text field", async () => {
    await open();
    fireEvent.press(screen.getByText("Photographs"));
    expect(await screen.findByText("Choose photograph")).toBeTruthy();
    expect(screen.queryByLabelText("Photo URI")).toBeNull();
    expect(apiClient.listFamilyTreeMediaReferences).toHaveBeenCalledWith(
      3,
      options,
    );
  });
  it("previews explicit duplicate target/scalar/episode choices and commits alias retargeting", async () => {
    const preview = jest
      .spyOn(apiClient, "previewFamilyTreeMerge")
      .mockResolvedValue(job("merge", mergeSummary));
    const mutation = jest
      .spyOn(apiClient, "commitFamilyTreeMerge")
      .mockImplementation(commit);
    await open();
    fireEvent.press(screen.getByText("Duplicate / merge"));
    fireEvent.press(screen.getByText("Merge into Ada (#4)"));
    fireEvent.press(screen.getByText("Preview merge"));
    await screen.findByText("Retarget aliases: #8");
    expect(screen.getByText("Source display_name: Ada")).toBeTruthy();
    expect(screen.getByText("Target display_name: Ada")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Retain display_name from source"));
    fireEvent.press(
      screen.getByLabelText("Retain separate similar partnership episodes"),
    );
    fireEvent.press(screen.getByText("Preview merge"));
    await waitFor(() =>
      expect(preview).toHaveBeenLastCalledWith(
        expect.objectContaining({
          source_person_id: 3,
          target_person_id: 4,
          expected_graph_revision: 2,
          scalar_choices: { display_name: "source" },
          retain_similar_partner_episodes: true,
        }),
        options,
      ),
    );
    fireEvent.press(screen.getByLabelText("Confirm merge #3 into #4"));
    fireEvent.press(screen.getByText("Commit merge"));
    await waitFor(() =>
      expect(mutation).toHaveBeenCalledWith(
        expect.objectContaining({
          preview_token: "token",
          expected_graph_revision: 2,
          idempotency_key: expect.any(String),
        }),
        options,
      ),
    );
  });
  it("owner capability, not account role, gates password-body purge", async () => {
    const preview = jest
      .spyOn(apiClient, "previewFamilyTreePurge")
      .mockResolvedValue(
        job("purge", {
          person_id: 3,
          alias_only: false,
          retained_backup_policy: "Historical backups expire by policy",
          stories: 1,
          residences: 0,
          media_references: 0,
        }),
      );
    const mutation = jest
      .spyOn(apiClient, "commitFamilyTreePurge")
      .mockImplementation(commit);
    await open();
    fireEvent.press(screen.getByText("Permanent purge"));
    fireEvent.changeText(screen.getByLabelText("Fresh password"), " pass ");
    fireEvent.press(screen.getByText("Preview purge"));
    await screen.findByText("Historical backups expire by policy");
    expect(preview).toHaveBeenCalledWith(
      3,
      { password: " pass ", expected_graph_revision: 2 },
      options,
    );
    fireEvent.changeText(screen.getByLabelText("Fresh password"), " pass ");
    fireEvent.press(screen.getByLabelText("Confirm permanent purge of #3"));
    fireEvent.press(screen.getByText("Commit purge"));
    await waitFor(() =>
      expect(mutation).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
          password: " pass ",
          preview_token: "token",
          idempotency_key: expect.any(String),
          expected_graph_revision: 2,
        }),
        options,
      ),
    );
  });
  it("creates and polls a logical JSON export with explicit media omissions", async () => {
    const created = jest
      .spyOn(apiClient, "createFamilyTreeExport")
      .mockResolvedValue(
        job("export", {
          format: "json",
          people: 2,
          media: 0,
          media_omitted: true,
        }),
      );
    const poll = jest
      .spyOn(apiClient, "getFamilyTreeExportJob")
      .mockResolvedValue(
        job("export", {
          format: "json",
          people: 2,
          media: 0,
          media_omitted: true,
        }),
      );
    mount();
    fireEvent.press(await screen.findByText("Import / export"));
    fireEvent.press(screen.getByText("Create JSON export"));
    await screen.findByText("Media omitted: yes");
    expect(created).toHaveBeenCalledWith({ format: "json" }, options);
    fireEvent.press(screen.getByText("Refresh export status"));
    await waitFor(() => expect(poll).toHaveBeenCalledWith(9, options));
  });
});
