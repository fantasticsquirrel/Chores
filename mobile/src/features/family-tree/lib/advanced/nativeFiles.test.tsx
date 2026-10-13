import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import * as imagePicker from "expo-image-picker";
import * as documentPicker from "expo-document-picker";
import * as sharing from "expo-sharing";
const mockFiles = new Map<string, number>();
const mockDeleted: string[] = [];
const mockWritten: Uint8Array[] = [];
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));
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
    create() {}
    delete() {
      mockDeleted.push(this.uri);
    }
    exists = true;
  }
  class File extends Directory {
    get size() {
      return mockFiles.get(this.uri) ?? 5;
    }
    async copy(dest: File) {
      mockFiles.set(dest.uri, this.size);
    }
    write(bytes: Uint8Array) {
      mockWritten.push(bytes);
    }
  }
  return {
    File,
    Directory,
    Paths: {
      cache: { uri: "file:///cache" },
      document: { uri: "file:///app/Documents" },
    },
  };
});
import {
  pickPhotograph,
  pickPackage,
  multipart,
  shareDownload,
} from "./nativeFiles";
const originalFormData = global.FormData;
const NativeFormData = jest.requireActual<{ default: typeof FormData }>(
  "react-native/Libraries/Network/FormData",
).default;
beforeEach(() => {
  global.FormData = NativeFormData;
});
afterEach(() => {
  global.FormData = originalFormData;
  jest.clearAllMocks();
  mockFiles.clear();
  mockDeleted.length = 0;
  mockWritten.length = 0;
});
describe("installed Expo native adapter seam", () => {
  it("cleans an unsupported SDK iOS direct-cache copy even when format validation fails", async () => {
    const uri = "file:///cache/01234567-89ab-cdef-0123-456789abcdef.gif";
    jest
      .mocked(imagePicker.launchImageLibraryAsync)
      .mockResolvedValue({
        canceled: false,
        assets: [
          { uri, width: 1, height: 1, mimeType: "image/gif", fileSize: 5 },
        ],
      });
    await expect(pickPhotograph()).rejects.toThrow("JPEG");
    expect(mockDeleted).toContain(uri);
  });
  it.each([
    "file:///app/Documents/Inbox/private%20source.zip",
    "file:///app/tmp/app-Inbox/private.zip",
  ])(
    "cleans the exact OS-imported document copy %s, never a provider original",
    async (uri) => {
      jest
        .mocked(documentPicker.getDocumentAsync)
        .mockResolvedValue({
          canceled: false,
          assets: [
            {
              uri,
              name: "private.zip",
              size: 5,
              lastModified: 0,
              mimeType: "application/zip",
            },
          ],
        });
      const selected = await pickPackage();
      selected!.release();
      expect(mockDeleted).toContain(uri);
    },
  );

  it("sends actual native URI FormData and authorized binary bytes through production ApiClient, with cookies, CSRF and per-call signals", async () => {
    const { ApiClient, CSRF_HEADER_NAME } = jest.requireActual<
      typeof import("../../../../api/client")
    >("../../../../api/client");
    const fetchImpl = jest.fn<typeof fetch>();
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
      });
    fetchImpl.mockResolvedValueOnce(
      json({
        csrf_token: "native-csrf",
        user: {
          id: 1,
          household_id: 27,
          email: "qa@example.test",
          role: "PARENT",
        },
      }),
    );
    fetchImpl.mockResolvedValueOnce(json({ id: 11 }));
    fetchImpl.mockResolvedValueOnce(json({ id: 9 }));
    fetchImpl.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 255]), {
        headers: { "Content-Type": "image/png" },
      }),
    );
    fetchImpl.mockResolvedValueOnce(
      new Response(new Uint8Array([3, 4, 255]), {
        headers: { "Content-Type": "application/zip" },
      }),
    );
    const api = new ApiClient({
      baseUrl: "https://family.example.test/chore-api",
      fetchImpl,
    });
    await api.login({ email: "qa@example.test", password: "test-only" });
    const controller = new AbortController(),
      options = { signal: controller.signal };
    const selection = {
      uri: "file:///cache/family-tree-owned/photo.png",
      name: "photograph.png",
      type: "image/png",
      size: 3,
      release: () => {},
    };
    const photo = multipart(selection, { caption: "Caption" }),
      packageBody = multipart(
        { ...selection, name: "family-tree.zip", type: "application/zip" },
        { expected_graph_revision: "2" },
      );
    await api.uploadFamilyTreeMedia(photo, options);
    await api.stageFamilyTreeImport(packageBody, options);
    const image = await api.getFamilyTreeMediaContent(11, options),
      bundle = await api.downloadFamilyTreeExport(9, options);
    expect([...new Uint8Array(image.bytes)]).toEqual([1, 2, 255]);
    expect([...new Uint8Array(bundle.bytes)]).toEqual([3, 4, 255]);
    for (const [url, init] of fetchImpl.mock.calls.slice(1)) {
      expect(init).toMatchObject({
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });
      expect(String(url)).not.toContain("native-csrf");
      expect(String(url)).not.toContain("file:");
    }
    for (const [index, body] of [
      [1, photo],
      [2, packageBody],
    ] as const) {
      const init = fetchImpl.mock.calls[index][1];
      expect(init?.body).toBe(body);
      const headers = new Headers(init?.headers);
      expect(headers.get(CSRF_HEADER_NAME)).toBe("native-csrf");
      expect(headers.has("Content-Type")).toBe(false);
      expect((body as any).getParts()[0]).toMatchObject({
        uri: selection.uri,
        name: index === 1 ? "photograph.png" : "family-tree.zip",
        type: index === 1 ? "image/png" : "application/zip",
      });
    }
  });
  it("cleans temporary bytes when native sharing fails and never uses a downloaded private filename", async () => {
    jest.mocked(sharing.isAvailableAsync).mockResolvedValueOnce(true);
    jest
      .mocked(sharing.shareAsync)
      .mockRejectedValueOnce(new Error("Sharing canceled"));
    await expect(
      shareDownload(
        {
          bytes: new Uint8Array([1]).buffer,
          content_type: "application/json",
          filename: "private-path.json",
        },
        () => true,
      ),
    ).rejects.toThrow("Sharing canceled");
    expect(mockDeleted.some((x) => x.includes("family-tree-"))).toBe(true);
    expect(sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringContaining("family-tree.json"),
      expect.any(Object),
    );
  });
  it.each(["image/svg+xml", "image/heic", "text/html"])(
    "rejects %s before any local copy or request",
    async (type) => {
      jest.mocked(imagePicker.launchImageLibraryAsync).mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: "file:///cache/ImagePicker/unsafe.png",
            width: 1,
            height: 1,
            mimeType: type,
            fileSize: 5,
          },
        ],
      });
      await expect(pickPhotograph()).rejects.toThrow("JPEG");
      expect(mockDeleted).toEqual(["file:///cache/ImagePicker/unsafe.png"]);
    },
  );
  it("cleans the exact SDK iOS UUID picker copy in direct caches, but never unrelated cache paths", async () => {
    const uri = "file:///cache/01234567-89ab-cdef-0123-456789abcdef.png";
    jest.mocked(imagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        { uri, width: 1, height: 1, mimeType: "image/png", fileSize: 5 },
      ],
    });
    const selected = await pickPhotograph();
    selected!.release();
    expect(mockDeleted).toContain(uri);
  });

  it("uses photos-only picker and actual URI/name/type RN FormData parts", async () => {
    jest.mocked(imagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///cache/ImagePicker/copy.png",
          width: 1,
          height: 1,
          mimeType: "image/png",
          fileSize: 5,
        },
      ],
    });
    const file = await pickPhotograph();
    expect(file).not.toBeNull();
    expect(imagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ["images"],
        exif: false,
        base64: false,
      }),
    );
    const body = multipart(file!, { caption: "Label" });
    const parts = (body as any).getParts();
    expect(parts[0]).toMatchObject({
      uri: expect.stringContaining("family-tree-"),
      name: "photograph.png",
      type: "image/png",
    });
    expect(parts[1]).toMatchObject({ string: "Label", fieldName: "caption" });
    file!.release();
    expect(mockDeleted).toContain("file:///cache/ImagePicker/copy.png");
  });
  it("never removes selected originals outside picker-owned copies", async () => {
    jest.mocked(imagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///photos/original.jpg",
          width: 1,
          height: 1,
          mimeType: "image/jpeg",
          fileSize: 5,
        },
      ],
    });
    const selected = await pickPhotograph();
    selected!.release();
    expect(mockDeleted).not.toContain("file:///photos/original.jpg");
  });
  it("rejects image size/type boundary and releases known picker copy on failure", async () => {
    jest.mocked(imagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///cache/ImagePicker/big.jpg",
          width: 1,
          height: 1,
          mimeType: "image/jpeg",
          fileSize: 10485761,
        },
      ],
    });
    await expect(pickPhotograph()).rejects.toThrow();
    expect(mockDeleted).toContain("file:///cache/ImagePicker/big.jpg");
  });
  it("uses JSON/ZIP document picker without an unobserved SDK cache copy", async () => {
    jest.mocked(documentPicker.getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "content://documents/a",
          name: "personal-name.zip",
          size: 5,
          lastModified: 0,
          mimeType: "application/zip",
        },
      ],
    });
    const selected = await pickPackage();
    expect(documentPicker.getDocumentAsync).toHaveBeenCalledWith({
      type: ["application/json", "application/zip"],
      copyToCacheDirectory: false,
      multiple: false,
    });
    expect(selected).toMatchObject({
      name: "family-tree.zip",
      type: "application/zip",
    });
    selected!.release();
    expect(mockDeleted).not.toContain("content://documents/a");
  });
  it("writes exact ArrayBuffer bytes only for user export and cleans after sharing", async () => {
    await shareDownload(
      {
        bytes: new Uint8Array([1, 2, 255]).buffer,
        content_type: "application/zip",
        filename: "../../personal.zip",
      },
      () => true,
    );
    expect(mockWritten.map((x) => [...x])).toEqual([[1, 2, 255]]);
    expect(sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringContaining("family-tree.zip"),
      expect.objectContaining({ mimeType: "application/zip" }),
    );
    expect(mockDeleted.some((x) => x.includes("family-tree-"))).toBe(true);
  });
  it("never creates or shares private bytes after scope invalidation", async () => {
    await expect(
      shareDownload(
        {
          bytes: new ArrayBuffer(5),
          content_type: "application/json",
          filename: null,
        },
        () => false,
      ),
    ).rejects.toThrow();
    expect(mockWritten).toEqual([]);
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });
});
