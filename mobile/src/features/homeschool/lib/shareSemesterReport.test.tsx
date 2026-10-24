import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { File } from "expo-file-system";
import * as sharing from "expo-sharing";
import { shareSemesterReport } from "./shareSemesterReport";
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  File: jest
    .fn()
    .mockImplementation(() => ({
      exists: true,
      uri: "file:///cache/report.pdf",
      create: jest.fn(),
      write: jest.fn(),
      delete: jest.fn(),
    })),
}));
const pdf = {
  bytes: new Uint8Array([37, 80, 68, 70]).buffer,
  content_type: "application/pdf",
  filename: "report.pdf",
};
describe("shareSemesterReport", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it("shares the authenticated PDF and removes the temporary file", async () => {
    jest.mocked(sharing.isAvailableAsync).mockResolvedValue(true);
    jest.mocked(sharing.shareAsync).mockResolvedValue();
    await shareSemesterReport(pdf, () => true);
    const file = jest.mocked(File).mock.results[0].value as File;
    expect(file.write).toHaveBeenCalledWith(new Uint8Array(pdf.bytes));
    expect(sharing.shareAsync).toHaveBeenCalledWith(
      file.uri,
      expect.objectContaining({ mimeType: "application/pdf" }),
    );
    expect(file.delete).toHaveBeenCalled();
  });
  it("blocks stale scope, malformed output and unavailable sharing", async () => {
    await expect(shareSemesterReport(pdf, () => false)).rejects.toThrow(
      "changed",
    );
    await expect(
      shareSemesterReport({ ...pdf, content_type: "text/html" }, () => true),
    ).rejects.toThrow("Invalid");
    jest.mocked(sharing.isAvailableAsync).mockResolvedValue(false);
    await expect(shareSemesterReport(pdf, () => true)).rejects.toThrow(
      "not available",
    );
    expect(File).not.toHaveBeenCalled();
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });
  it("checks scope again after async availability before writing child data", async () => {
    let current = true;
    jest.mocked(sharing.isAvailableAsync).mockImplementation(async () => {
      current = false;
      return true;
    });
    await expect(shareSemesterReport(pdf, () => current)).rejects.toThrow(
      "changed",
    );
    expect(File).not.toHaveBeenCalled();
  });
});
