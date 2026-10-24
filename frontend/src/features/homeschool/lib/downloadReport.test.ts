import { downloadSemesterPdf } from "./downloadReport";

describe("PDF download", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it("rejects non-PDF responses without opening anything", () => {
    expect(() => downloadSemesterPdf({ bytes: new ArrayBuffer(4), content_type: "text/html", filename: null }, 1, 2)).toThrow("Unexpected report content type");
  });
  it("downloads a scoped safe filename and releases its private object URL", () => {
    const create = vi.fn(() => "blob:test-pdf"); const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    let filename = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });
    downloadSemesterPdf({ bytes: new ArrayBuffer(4), content_type: "application/pdf", filename: 'attachment; filename="unsafe/server/name.pdf"' }, 1, 2);
    expect(filename).toBe("homeschool-semester-1-child-2.pdf");
    expect(revoke).toHaveBeenCalledWith("blob:test-pdf");
    expect(document.querySelector("a[download]")).toBeNull();
  });
});
