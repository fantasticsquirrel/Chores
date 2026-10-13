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

describe("native destructive recovery remediation composition", () => {
  async function outageAndRecover() {
    const collectionReads = jest.mocked(apiClient.getFamilyTreeCollection).mock
      .calls.length;
    jest
      .mocked(apiClient.getMyModules)
      .mockRejectedValueOnce(new Error("Discovery outage"));
    fireEvent.press(screen.getByText("Refresh"));
    await screen.findByText("Discovery outage");
    fireEvent.press(screen.getByText("Retry Family Tree"));
    await screen.findByLabelText("Open Ada (#3)", {}, { timeout: 5000 });
    await waitFor(() =>
      expect(apiClient.getFamilyTreeCollection).toHaveBeenCalledTimes(
        collectionReads + 1,
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh" }).props.accessibilityState
          .disabled,
      ).toBe(false),
    );
  }
  it("retains the unknown merge body and canonical target across discovery-only hiding", async () => {
    const preview = jest
      .spyOn(apiClient, "previewFamilyTreeMerge")
      .mockResolvedValue(job("merge", mergeSummary));
    const mutation = jest
      .spyOn(apiClient, "commitFamilyTreeMerge")
      .mockRejectedValueOnce(new Error("Unknown merge"))
      .mockImplementationOnce(commit);
    await open();
    fireEvent.press(screen.getByText("Duplicate / merge"));
    fireEvent.press(screen.getByText("Merge into Ada (#4)"));
    fireEvent.press(screen.getByText("Preview merge"));
    await screen.findByText("Retarget aliases: #8");
    fireEvent.press(screen.getByLabelText("Retain display_name from source"));
    fireEvent.press(
      screen.getByLabelText("Retain separate similar partnership episodes"),
    );
    fireEvent.press(screen.getByText("Preview merge"));
    await screen.findByText("Retarget aliases: #8");
    fireEvent.press(screen.getByLabelText("Confirm merge #3 into #4"));
    fireEvent.press(screen.getByText("Commit merge"));
    await screen.findByText("Unknown merge");
    const body = mutation.mock.calls[0][0];
    setRevision(5);
    jest
      .mocked(apiClient.getFamilyTreePerson)
      .mockRejectedValue(new Error("Original person absent"));
    await outageAndRecover();
    await outageAndRecover();
    console.log(
      "OBSERVED merge recovery",
      JSON.stringify({
        postCount: mutation.mock.calls.length,
        hasRetry: screen.queryByText("Retry original merge") !== null,
      }),
    );
    expect(
      screen.getByLabelText("Retain display_name from source").props
        .accessibilityState.checked,
    ).toBe(true);
    expect(
      screen.getByLabelText("Retain separate similar partnership episodes")
        .props.accessibilityState.checked,
    ).toBe(true);
    fireEvent.press(screen.getByText("Retry original merge"));
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(2));
    expect(mutation.mock.calls[1][0]).toEqual(body);
    expect(preview).toHaveBeenCalledTimes(2);
  });
  it("retains the unknown purge facts across discovery-only hiding but still requires a newly entered password", async () => {
    const preview = jest
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
      .mockRejectedValueOnce(new Error("Unknown purge"))
      .mockImplementationOnce(commit);
    await open();
    fireEvent.press(screen.getByText("Permanent purge"));
    fireEvent.changeText(
      screen.getByLabelText("Fresh password"),
      "first per-attempt input",
    );
    fireEvent.press(screen.getByText("Preview purge"));
    await screen.findByText("Backup policy");
    fireEvent.changeText(
      screen.getByLabelText("Fresh password"),
      "first per-attempt input",
    );
    fireEvent.press(screen.getByLabelText("Confirm permanent purge of #3"));
    fireEvent.press(screen.getByText("Commit purge"));
    await screen.findByText("Unknown purge");
    const body = mutation.mock.calls[0][1];
    setRevision(5);
    jest
      .mocked(apiClient.getFamilyTreePerson)
      .mockRejectedValue(new Error("Original person absent"));
    await outageAndRecover();
    await outageAndRecover();
    console.log(
      "OBSERVED purge recovery",
      JSON.stringify({
        postCount: mutation.mock.calls.length,
        hasRetry: screen.queryByText("Retry original purge") !== null,
      }),
    );
    expect(screen.getByText("Retry original purge")).toBeTruthy();
    expect(screen.getByLabelText("Fresh password").props.value).toBe("");
    fireEvent.changeText(
      screen.getByLabelText("Fresh password"),
      "new per-attempt input",
    );
    fireEvent.press(screen.getByText("Retry original purge"));
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(2));
    expect(mutation.mock.calls[1][1]).toEqual({
      ...body,
      password: "new per-attempt input",
    });
    expect(preview).toHaveBeenCalledTimes(1);
  });

  it.each(["merge", "purge"] as const)(
    "known %s ACK stays GET-only through repeated discovery hiding",
    async (kind) => {
      const post =
        kind === "merge"
          ? jest
              .spyOn(apiClient, "commitFamilyTreeMerge")
              .mockImplementation(commit)
          : jest
              .spyOn(apiClient, "commitFamilyTreePurge")
              .mockImplementation(commit);
      if (kind === "merge")
        jest
          .spyOn(apiClient, "previewFamilyTreeMerge")
          .mockResolvedValue(job("merge", mergeSummary));
      else
        jest
          .spyOn(apiClient, "previewFamilyTreePurge")
          .mockResolvedValue(
            job("purge", {
              person_id: 3,
              alias_only: false,
              retained_backup_policy: "Policy",
              stories: 0,
              residences: 0,
              media_references: 0,
            }),
          );
      await open();
      fireEvent.press(
        screen.getByText(
          kind === "merge" ? "Duplicate / merge" : "Permanent purge",
        ),
      );
      if (kind === "merge")
        fireEvent.press(screen.getByText("Merge into Ada (#4)"));
      else
        fireEvent.changeText(
          screen.getByLabelText("Fresh password"),
          "preview credential",
        );
      fireEvent.press(
        screen.getByText(kind === "merge" ? "Preview merge" : "Preview purge"),
      );
      await screen.findByText(
        kind === "merge" ? "Retarget aliases: #8" : "Policy",
      );
      if (kind === "purge")
        fireEvent.changeText(
          screen.getByLabelText("Fresh password"),
          "commit credential",
        );
      fireEvent.press(
        screen.getByLabelText(
          kind === "merge"
            ? "Confirm merge #3 into #4"
            : "Confirm permanent purge of #3",
        ),
      );
      jest
        .mocked(apiClient.getMyModules)
        .mockRejectedValueOnce(new Error("ACK discovery outage"));
      fireEvent.press(
        screen.getByText(kind === "merge" ? "Commit merge" : "Commit purge"),
      );
      await screen.findByText("ACK discovery outage");
      expect(post).toHaveBeenCalledTimes(1);
      fireEvent.press(screen.getByText("Retry Family Tree"));
      await screen.findByLabelText("Open Ada (#3)", {}, { timeout: 5000 });
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Refresh" }).props
            .accessibilityState.disabled,
        ).toBe(false),
      );
      await outageAndRecover();
      expect(screen.queryByText(`Retry original ${kind}`)).toBeNull();
      expect(post).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole("button", { name: "Add person" }).props
          .accessibilityState.disabled,
      ).toBe(false);
    },
  );
});
