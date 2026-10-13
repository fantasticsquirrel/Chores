import {
  apiClient,
  imagePicker,
  documentPicker,
  mount,
  mounted,
  open,
  job,
  mergeSummary,
  importSummary,
  commit,
  session,
  grant,
  setRevision,
} from "./recoveryFixture";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type * as FT from "@family-manager/family-api/models";
import { FamilyTreeScreen } from "../../../screens/FamilyTreeScreen";

describe("native recovery remediation composition", () => {
  async function outageAndRecover() {
    jest
      .mocked(apiClient.getMyModules)
      .mockRejectedValueOnce(new Error("Discovery outage"));
    fireEvent.press(screen.getByText("Refresh"));
    await screen.findByText("Discovery outage");
    expect(screen.queryByText("Choose photograph")).toBeNull();
    fireEvent.press(screen.getByText("Retry Family Tree"));
    await screen.findByLabelText("Open Ada (#3)", {}, { timeout: 5000 });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh" }).props.accessibilityState
          .disabled,
      ).toBe(false),
    );
  }
  const asset = {
    id: 11,
    mime_type: "image/png",
    byte_size: 5,
    width: 1,
    height: 1,
    checksum: "sum",
    caption: null,
    state: "ready",
  };
  async function prepareUnknownPhoto() {
    jest
      .mocked(imagePicker.launchImageLibraryAsync)
      .mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: "file:///cache/ImagePicker/p.png",
            width: 1,
            height: 1,
            mimeType: "image/png",
            fileSize: 5,
          },
        ],
      });
    jest.spyOn(apiClient, "uploadFamilyTreeMedia").mockResolvedValue(asset);
    const attach = jest
      .spyOn(apiClient, "attachFamilyTreeMedia")
      .mockRejectedValueOnce(new Error("Unknown attachment"))
      .mockImplementationOnce(commit);
    await open();
    fireEvent.press(screen.getByText("Photographs"));
    await screen.findByText("Choose photograph");
    fireEvent.press(screen.getByText("Choose photograph"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Upload and attach photograph" })
          .props.accessibilityState.disabled,
      ).toBe(false),
    );
    fireEvent.press(screen.getByLabelText("Photograph role: primary"));
    fireEvent.press(screen.getByText("Upload and attach photograph"));
    await screen.findByText("Unknown attachment");
    return attach;
  }
  async function prepareUnknownImport() {
    jest
      .mocked(documentPicker.getDocumentAsync)
      .mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: "content://documents/package",
            name: "family.zip",
            size: 5,
            lastModified: 0,
            mimeType: "application/zip",
          },
        ],
      });
    jest
      .spyOn(apiClient, "stageFamilyTreeImport")
      .mockResolvedValue(job("import", importSummary));
    const mutation = jest
      .spyOn(apiClient, "commitFamilyTreeImport")
      .mockRejectedValueOnce(new Error("Unknown import"))
      .mockImplementationOnce(commit);
    mount();
    fireEvent.press(
      await screen.findByText("Import / export", {}, { timeout: 5000 }),
    );
    fireEvent.press(screen.getByText("Choose JSON / ZIP append import"));
    await screen.findByText("Upload and stage append import");
    fireEvent.press(screen.getByText("Upload and stage append import"));
    await screen.findByText("Missing media: 1");
    fireEvent.press(
      screen.getByLabelText(
        "Confirm reviewed append import #9, including warnings and missing media",
      ),
    );
    fireEvent.press(
      screen.getByLabelText("Acknowledge duplicate import provenance"),
    );
    fireEvent.press(screen.getByText("Commit append import"));
    await screen.findByText("Unknown import");
    return mutation;
  }
  it("preserves unknown photograph intent through discovery-only hiding and retries its exact body", async () => {
    const attach = await prepareUnknownPhoto();
    const original = attach.mock.calls[0][1];
    await outageAndRecover();
    await outageAndRecover();
    expect(
      screen.getByRole("button", { name: "Add person" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    await screen.findByText("Photographs");
    console.log(
      "OBSERVED photo recovery",
      JSON.stringify({
        postCount: attach.mock.calls.length,
        hasRetry:
          screen.queryByText("Retry original photograph attachment") !== null,
        addEnabled:
          screen.getByRole("button", { name: "Add person" }).props
            .accessibilityState.disabled === false,
      }),
    );
    // A network discovery failure is not an affirmative invalidation/discard.
    const retry = screen.getByText("Retry original photograph attachment");
    fireEvent.press(retry);
    await waitFor(() => expect(attach).toHaveBeenCalledTimes(2));
    expect(attach.mock.calls[1][1]).toEqual(original);
    expect(apiClient.uploadFamilyTreeMedia).toHaveBeenCalledTimes(1);
  });
  it("preserves duplicate provenance confirmation required to retry an unknown import after discovery-only hiding", async () => {
    const mutation = await prepareUnknownImport();
    const original = mutation.mock.calls[0][1];
    jest
      .mocked(apiClient.getMyModules)
      .mockRejectedValueOnce(new Error("Discovery outage"));
    fireEvent.press(screen.getByText("Refresh"));
    await screen.findByText("Discovery outage");
    fireEvent.press(screen.getByText("Retry Family Tree"));
    fireEvent.press(
      await screen.findByText("Import / export", {}, { timeout: 5000 }),
    );
    await screen.findByText("Retry original append import");
    const provenance = screen.getByLabelText(
      "Acknowledge duplicate import provenance",
    );
    console.log(
      "OBSERVED import recovery",
      JSON.stringify({
        provenance: provenance.props.accessibilityState,
        confirmation: screen.getByLabelText(
          "Confirm reviewed append import #9, including warnings and missing media",
        ).props.accessibilityState,
        retry: screen.getByRole("button", {
          name: "Retry original append import",
        }).props.accessibilityState,
        postCount: mutation.mock.calls.length,
      }),
    );
    expect(provenance.props.accessibilityState.checked).toBe(true);
    fireEvent.press(screen.getByText("Retry original append import"));
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(2));
    expect(mutation.mock.calls[1][1]).toEqual(original);
  });
  it("keeps known photo ACK GET-only through discovery outage in the actual screen", async () => {
    await prepareUnknownPhoto();
    jest
      .mocked(apiClient.getMyModules)
      .mockRejectedValueOnce(new Error("Discovery outage"));
    fireEvent.press(screen.getByText("Retry original photograph attachment"));
    await screen.findByText("Discovery outage");
    expect(apiClient.attachFamilyTreeMedia).toHaveBeenCalledTimes(2);
    fireEvent.press(screen.getByText("Retry Family Tree"));
    await screen.findByLabelText("Open Ada (#3)", {}, { timeout: 5000 });
    await waitFor(() =>
      expect(apiClient.getFamilyTreePerson).toHaveBeenCalledTimes(2),
    );
    expect(apiClient.attachFamilyTreeMedia).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByText("Retry original photograph attachment"),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Add person" }).props
        .accessibilityState.disabled,
    ).toBe(false);
  });
  it("retains the first-person draft and its original revision across discovery-only hiding", async () => {
    const post = jest
      .spyOn(apiClient, "createFamilyTreePerson")
      .mockRejectedValue(new Error("Unknown create"));
    mount();
    fireEvent.press(
      await screen.findByText("Add person", {}, { timeout: 5000 }),
    );
    fireEvent.changeText(
      screen.getByLabelText("Display name"),
      "Retained original",
    );
    setRevision(3);
    jest
      .mocked(apiClient.getMyModules)
      .mockRejectedValueOnce(new Error("Discovery outage"));
    fireEvent.press(screen.getByText("Refresh"));
    await screen.findByText("Discovery outage");
    fireEvent.press(screen.getByText("Retry Family Tree"));
    await screen.findByLabelText("Display name");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save changes" }).props
          .accessibilityState.disabled,
      ).toBe(false),
    );
    expect(screen.getByLabelText("Display name").props.value).toBe(
      "Retained original",
    );
    fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0].expected_graph_revision).toBe(2);
  });
  it("clears protected unknown media on affirmative denial in the actual screen", async () => {
    const attach = await prepareUnknownPhoto();
    jest.mocked(apiClient.getMyModules).mockResolvedValueOnce({ modules: [] });
    fireEvent.press(screen.getByText("Refresh"));
    await screen.findByText("Family Tree is not enabled for your account.");
    expect(screen.queryByLabelText("Open Ada (#3)")).toBeNull();
    expect(
      screen.queryByText("Retry original photograph attachment"),
    ).toBeNull();
    expect(attach).toHaveBeenCalledTimes(1);
  });

  it.each(["gallery", "story"] as const)(
    "restores original %s attachment even when current detail is missing",
    async (role) => {
      const attach = await prepareUnknownPhoto();
      // Explicitly discard the first command, then prepare a separate reviewed role.
      fireEvent.press(screen.getByText("Discard photograph draft"));
      fireEvent.press(screen.getByText("Confirm discard photograph draft"));
      jest
        .mocked(apiClient.attachFamilyTreeMedia)
        .mockReset()
        .mockRejectedValueOnce(new Error("Unknown role"))
        .mockImplementationOnce(commit);
      fireEvent.press(screen.getByText("Choose photograph"));
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Upload and attach photograph" })
            .props.accessibilityState.disabled,
        ).toBe(false),
      );
      fireEvent.press(screen.getByLabelText(`Photograph role: ${role}`));
      if (role === "story") {
        jest
          .mocked(apiClient.listFamilyTreeStories)
          .mockResolvedValue({
            graph_revision: 2,
            items: [
              {
                id: 17,
                person_id: 3,
                title: "Original story",
                body_md: "Facts",
                position: 0,
                created_by_user_id: 1,
                date: null,
                source_label: null,
                source_url: null,
              },
            ],
            next_cursor: null,
          });
        fireEvent.press(screen.getByText("Refresh"));
        fireEvent.press(
          await screen.findByLabelText(
            "Photograph for story Original story (#17)",
          ),
        );
      }
      fireEvent.press(screen.getByText("Upload and attach photograph"));
      await screen.findByText("Unknown role");
      const body = attach.mock.calls[0][1];
      jest
        .mocked(apiClient.getFamilyTreePerson)
        .mockRejectedValue(new Error("Original person absent"));
      setRevision(5);
      await outageAndRecover();
      await outageAndRecover();
      expect(
        screen.getByLabelText(`Photograph role: ${role}`).props
          .accessibilityState.selected,
      ).toBe(true);
      fireEvent.press(screen.getByText("Retry original photograph attachment"));
      await waitFor(() => expect(attach).toHaveBeenCalledTimes(2));
      expect(attach.mock.calls[1][1]).toEqual(body);
      expect(body).toMatchObject({
        person_id: 3,
        role,
        story_id: role === "story" ? 17 : null,
        expected_graph_revision: 2,
      });
      expect(apiClient.uploadFamilyTreeMedia).toHaveBeenCalledTimes(2);
    },
  );
  it("restores removal reference and explicit consent without relying on a new reference list", async () => {
    const asset = {
      id: 11,
      mime_type: "image/png",
      byte_size: 5,
      width: 1,
      height: 1,
      checksum: "sum",
      caption: null,
      state: "ready",
    };
    const reference: FT.FamilyTreeMediaReference = {
      id: 13,
      asset_id: 11,
      person_id: 3,
      story_id: 17,
      role: "story",
      asset,
    };
    jest
      .mocked(apiClient.listFamilyTreeMediaReferences)
      .mockResolvedValue([reference]);
    const remove = jest
      .spyOn(apiClient, "removeFamilyTreeMediaReference")
      .mockRejectedValueOnce(new Error("Unknown remove"))
      .mockImplementationOnce(commit);
    await open();
    fireEvent.press(screen.getByText("Photographs"));
    fireEvent.press(await screen.findByText("Remove photograph reference #13"));
    fireEvent.press(
      screen.getByLabelText("Confirm remove reference #13 from #3"),
    );
    fireEvent.press(screen.getByText("Confirm reference removal"));
    await screen.findByText("Unknown remove");
    const original = remove.mock.calls[0].slice(0, 3);
    jest.mocked(apiClient.listFamilyTreeMediaReferences).mockResolvedValue([]);
    await outageAndRecover();
    await outageAndRecover();
    expect(
      screen.getByLabelText("Confirm remove reference #13 from #3").props
        .accessibilityState.checked,
    ).toBe(true);
    fireEvent.press(screen.getByText("Confirm reference removal"));
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(2));
    expect(remove.mock.calls[1].slice(0, 3)).toEqual(original);
  });
});
