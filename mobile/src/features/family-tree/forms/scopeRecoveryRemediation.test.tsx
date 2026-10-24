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

describe("native recovery ownership retirement", () => {
  async function outageAndRecover() {
    jest
      .mocked(apiClient.getMyModules)
      .mockRejectedValueOnce(new Error("Discovery outage"));
    fireEvent.press(screen.getByText("Refresh"));
    await screen.findByText("Discovery outage");
    expect(screen.queryByText("Choose photograph")).toBeNull();
    fireEvent.press(screen.getByText("Retry Family Tree"));
    fireEvent.press(await screen.findByRole("button", { name: "People" }));
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
    jest.mocked(imagePicker.launchImageLibraryAsync).mockResolvedValue({
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
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh" }).props.accessibilityState
          .disabled,
      ).toBe(false),
    );
    return attach;
  }
  async function prepareUnknownImport() {
    jest.mocked(documentPicker.getDocumentAsync).mockResolvedValue({
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

  it("keeps ownership until confirmed discard, and retires it before any new command", async () => {
    const attach = await prepareUnknownPhoto();
    await outageAndRecover();
    fireEvent.press(screen.getByText("Discard photograph draft"));
    expect(
      screen.getByRole("button", { name: "Add person" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    fireEvent.press(screen.getByText("Keep photograph draft"));
    expect(
      screen.getByText("Retry original photograph attachment"),
    ).toBeTruthy();
    fireEvent.press(screen.getByText("Discard photograph draft"));
    fireEvent.press(screen.getByText("Confirm discard photograph draft"));
    expect(
      screen.queryByText("Retry original photograph attachment"),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Add person" }).props
        .accessibilityState.disabled,
    ).toBe(false);
    await outageAndRecover();
    expect(
      screen.queryByText("Retry original photograph attachment"),
    ).toBeNull();
    expect(attach).toHaveBeenCalledTimes(1);
  });
  it.each([
    "denial",
    "403",
    "401",
    "manage",
    "purge-capability",
    "export-capability",
  ] as const)(
    "clears unknown ownership on affirmative %s retirement",
    async (kind) => {
      const attach = await prepareUnknownPhoto();
      if (kind === "denial")
        jest
          .mocked(apiClient.getMyModules)
          .mockResolvedValueOnce({ modules: [] });
      else if (kind === "401" || kind === "403")
        jest
          .mocked(apiClient.getMyModules)
          .mockRejectedValueOnce(
            Object.assign(new Error("Denied"), { status: Number(kind) }),
          );
      else if (kind === "manage")
        jest
          .mocked(apiClient.getMyModules)
          .mockResolvedValue({ modules: [{ ...grant, can_manage: false }] });
      else {
        const collection = await apiClient.getFamilyTreeCollection();
        jest.mocked(apiClient.getFamilyTreeCollection).mockResolvedValue({
          ...collection,
          capabilities: {
            ...collection.capabilities,
            can_purge: kind !== "purge-capability",
            can_export: kind !== "export-capability",
          },
        });
      }
      await act(async () => {
        fireEvent.press(screen.getByText("Refresh"));
      });
      expect(
        screen.queryByText("Retry original photograph attachment"),
      ).toBeNull();
      // Regranting cannot resurrect retired private facts or a POST closure.
      jest
        .mocked(apiClient.getMyModules)
        .mockResolvedValue({ modules: [grant] });
      const refresh =
        screen.queryByText("Retry Family Tree") ?? screen.getByText("Refresh");
      fireEvent.press(refresh);
      fireEvent.press(await screen.findByRole("button", { name: "People" }));
      await screen.findByLabelText("Open Ada (#3)", {}, { timeout: 5000 });
      expect(
        screen.queryByText("Retry original photograph attachment"),
      ).toBeNull();
      expect(attach).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["household", "role", "session", "dispose"] as const)(
    "does not resurrect media after actual %s disposal",
    async (kind) => {
      const attach = await prepareUnknownPhoto();
      // Actual screen disposal tears down the feature-scoped runtime even while hidden.
      jest
        .mocked(apiClient.getMyModules)
        .mockRejectedValueOnce(new Error("Discovery outage"));
      fireEvent.press(screen.getByText("Refresh"));
      await screen.findByText("Discovery outage");
      const next: FT.AuthSessionResponse = {
        user: {
          ...session.user,
          household_id: kind === "household" ? 28 : 27,
          role: kind === "role" ? "PARENT_ADMIN" : "PARENT",
          id: kind === "session" ? 2 : 1,
        },
      };
      if (kind === "dispose") {
        mounted.unmount();
        render(
          <FamilyTreeScreen
            session={next}
            modules={[]}
            onModulesLoaded={() => {}}
          />,
        );
      } else
        mounted.rerender(
          <FamilyTreeScreen
            session={next}
            modules={[]}
            onModulesLoaded={() => {}}
          />,
        );
      fireEvent.press(await screen.findByRole("button", { name: "People" }));
      await screen.findByLabelText("Open Ada (#3)", {}, { timeout: 5000 });
      expect(
        screen.queryByText("Retry original photograph attachment"),
      ).toBeNull();
      expect(
        screen.getByRole("button", { name: "Add person" }).props
          .accessibilityState.disabled,
      ).toBe(false);
      expect(attach).toHaveBeenCalledTimes(1);
    },
  );
  it.each([true, false])(
    "preserves exact duplicate=%s append confirmation across repeated hiding and status refresh",
    async (duplicate) => {
      jest.mocked(documentPicker.getDocumentAsync).mockResolvedValue({
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
      const preview = job("import", {
        ...importSummary,
        duplicate_provenance: duplicate,
      });
      jest.spyOn(apiClient, "stageFamilyTreeImport").mockResolvedValue(preview);
      jest.spyOn(apiClient, "getFamilyTreeImportJob").mockResolvedValue({
        ...preview,
        summary: {
          ...importSummary,
          duplicate_provenance: !duplicate,
          people: 7,
        },
      });
      const mutation = jest
        .spyOn(apiClient, "commitFamilyTreeImport")
        .mockRejectedValueOnce(new Error("Unknown import"))
        .mockImplementationOnce(commit);
      mount();
      fireEvent.press(
        await screen.findByText("Import / export", {}, { timeout: 5000 }),
      );
      fireEvent.press(screen.getByText("Choose JSON / ZIP append import"));
      fireEvent.press(
        await screen.findByText("Upload and stage append import"),
      );
      await screen.findByText("Missing media: 1");
      fireEvent.press(
        screen.getByLabelText(
          "Confirm reviewed append import #9, including warnings and missing media",
        ),
      );
      if (duplicate)
        fireEvent.press(
          screen.getByLabelText("Acknowledge duplicate import provenance"),
        );
      fireEvent.press(screen.getByText("Commit append import"));
      await screen.findByText("Unknown import");
      const original = mutation.mock.calls[0][1];
      await outageAndRecover();
      await outageAndRecover();
      fireEvent.press(screen.getByText("Import / export"));
      fireEvent.press(screen.getByText("Refresh import status"));
      await waitFor(() =>
        expect(apiClient.getFamilyTreeImportJob).toHaveBeenCalledTimes(1),
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Retry original append import" })
            .props.accessibilityState.disabled,
        ).toBe(false),
      );
      expect(
        screen.getByLabelText(
          "Confirm reviewed append import #9, including warnings and missing media",
        ).props.accessibilityState.checked,
      ).toBe(true);
      fireEvent.press(screen.getByText("Retry original append import"));
      await waitFor(() => expect(mutation).toHaveBeenCalledTimes(2));
      expect(mutation.mock.calls[1][1]).toEqual(original);
      expect(original.acknowledge_duplicate_provenance).toBe(duplicate);
      expect(apiClient.stageFamilyTreeImport).toHaveBeenCalledTimes(1);
    },
  );

  it("retires a known append ACK before failed discovery and never replays it", async () => {
    const post = await prepareUnknownImport();
    jest
      .mocked(apiClient.getMyModules)
      .mockRejectedValueOnce(new Error("ACK discovery outage"));
    fireEvent.press(screen.getByText("Retry original append import"));
    await screen.findByText("ACK discovery outage");
    expect(post).toHaveBeenCalledTimes(2);
    fireEvent.press(screen.getByText("Retry Family Tree"));
    fireEvent.press(await screen.findByRole("button", { name: "People" }));
    await screen.findByLabelText("Open Ada (#3)", {}, { timeout: 5000 });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh" }).props.accessibilityState
          .disabled,
      ).toBe(false),
    );
    await outageAndRecover();
    fireEvent.press(screen.getByText("Import / export"));
    expect(screen.queryByText("Retry original append import")).toBeNull();
    expect(post).toHaveBeenCalledTimes(2);
    expect(apiClient.stageFamilyTreeImport).toHaveBeenCalledTimes(1);
  });
  it("retires append ownership only after explicit confirmed cancellation succeeds", async () => {
    const post = await prepareUnknownImport();
    const cancel = jest
      .spyOn(apiClient, "cancelFamilyTreeImport")
      .mockRejectedValueOnce(new Error("Cancellation unavailable"))
      .mockResolvedValueOnce({
        ...job("import", importSummary),
        state: "canceled",
      });
    fireEvent.press(screen.getByText("Cancel staged append import"));
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Confirm cancel staged import"));
    await screen.findByText("Cancellation unavailable");
    expect(screen.getByText("Retry original append import")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Add person" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirm cancel staged import" })
          .props.accessibilityState.disabled,
      ).toBe(false),
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Confirm cancel staged import"));
    });
    expect(screen.queryByText("Retry original append import")).toBeNull();
    await outageAndRecover();
    expect(screen.queryByText("Retry original append import")).toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(cancel.mock.calls.map(([id]) => id)).toEqual([9, 9]);
    expect(
      screen.getByRole("button", { name: "Add person" }).props
        .accessibilityState.disabled,
    ).toBe(false);
  });
});
