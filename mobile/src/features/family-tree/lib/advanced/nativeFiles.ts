import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import { isAvailableAsync, shareAsync } from "expo-sharing";
import type { BinaryDownload } from "@family-manager/family-api/client-core";
import { operationKey } from "../workflows/state";
import {
  EXPORT_LIMIT,
  IMAGE_LIMIT,
  IMAGE_TYPES,
  PACKAGE_LIMIT,
} from "./safety";
export type NativeSelection = {
  uri: string;
  name: string;
  type: string;
  size: number;
  release: () => void;
};
export type TrackTemporary = (release: () => void) => () => void;
function temporary() {
  const dir = new Directory(Paths.cache, `family-tree-${operationKey()}`);
  dir.create();
  let removed = false;
  return {
    dir,
    release: () => {
      if (!removed) {
        removed = true;
        if (dir.exists) dir.delete();
      }
    },
  };
}
function pickerCopy(uri: string) {
  const base = Paths.cache.uri.replace(/\/$/, "");
  // Installed SDK writes ImagePicker copies here; never remove a library original.
  const imagePickerPath = `${base}/ImagePicker/`;
  const directCachePath = `${base}/`;
  // SDK 56 iOS also generates a UUID-named file directly in caches when its cache path ends in '/'.
  const tail = uri.startsWith(imagePickerPath)
    ? uri.slice(imagePickerPath.length)
    : uri.startsWith(directCachePath) &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,10}$/i.test(
          uri.slice(directCachePath.length),
        )
      ? uri.slice(directCachePath.length)
      : "";
  if (!tail || tail.includes("/") || tail.includes("..") || tail.includes("%"))
    return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
function importedDocumentCopy(uri: string) {
  const cache = Paths.cache.uri.replace(/\/$/, "");
  const document = Paths.document?.uri.replace(/\/$/, "");
  const root = document?.endsWith("/Documents")
    ? document.slice(0, -"/Documents".length)
    : null;
  const prefix = [
    `${cache}/DocumentPicker/`,
    ...(document && root ? [`${document}/Inbox/`, `${root}/tmp/`] : []),
  ].find((p) => uri.startsWith(p));
  if (!prefix) return;
  const relative = uri.slice(prefix.length);
  if (
    !relative ||
    relative.includes("\\") ||
    /%2e|%2f|%5c/i.test(relative) ||
    relative.split("/").some((part) => !part || part === "." || part === "..")
  )
    return;
  // SDK 56 uses UIDocumentPicker asCopy:true even with cache-copy disabled.
  // Only its returned imported copy inside this app's sandbox is removed, never a provider original.
  const file = new File(uri);
  if (file.exists) file.delete();
}
function sizeCheck(size: number | undefined, limit: number) {
  if (!Number.isSafeInteger(size) || !size || size < 0 || size > limit)
    throw new Error(
      "Selected file is empty, unreadable or exceeds the upload limit.",
    );
}
async function copySelection(
  uri: string,
  type: string,
  name: string,
  limit: number,
  declared?: number,
): Promise<NativeSelection> {
  if (!/^(file|content):\/\//.test(uri))
    throw new Error("Select a local file using the native picker.");
  const source = new File(uri);
  if (declared !== undefined) sizeCheck(declared, limit);
  sizeCheck(source.size, limit);
  const owned = temporary();
  try {
    const file = new File(owned.dir, name);
    await source.copy(file);
    sizeCheck(file.size, limit);
    return {
      uri: file.uri,
      name,
      type,
      size: file.size,
      release: owned.release,
    };
  } catch (e) {
    owned.release();
    throw e;
  }
}
export async function pickPhotograph(): Promise<NativeSelection | null> {
  const selected = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    exif: false,
    base64: false,
    quality: 1,
  });
  if (selected.canceled) return null;
  const asset = selected.assets[0];
  if (!asset) throw new Error("No photograph was selected.");
  try {
    const type = asset.mimeType;
    if (
      !type ||
      !IMAGE_TYPES.includes(type) ||
      asset.width * asset.height > 25_000_000
    )
      throw new Error(
        "Choose a JPEG, PNG or WebP photograph up to 25 megapixels and 10 MiB.",
      );
    const extension = type === "image/jpeg" ? "jpg" : type.slice(6);
    return await copySelection(
      asset.uri,
      type,
      `photograph.${extension}`,
      IMAGE_LIMIT,
      asset.fileSize,
    );
  } finally {
    pickerCopy(asset.uri);
  }
}
export async function pickPackage(): Promise<NativeSelection | null> {
  const selected = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "application/zip"],
    copyToCacheDirectory: false,
    multiple: false,
  });
  if (selected.canceled) return null;
  const asset = selected.assets[0];
  if (!asset) throw new Error("No package was selected.");
  try {
    const extension = asset.name.toLowerCase().endsWith(".json")
      ? "json"
      : asset.name.toLowerCase().endsWith(".zip")
        ? "zip"
        : null;
    if (!extension)
      throw new Error(
        "Choose a logical JSON or ZIP Family Tree export. Database/GEDCOM replacement is unsupported.",
      );
    return await copySelection(
      asset.uri,
      `application/${extension}`,
      `family-tree.${extension}`,
      PACKAGE_LIMIT,
      asset.size,
    );
  } finally {
    importedDocumentCopy(asset.uri);
  }
}
export function multipart(
  file: NativeSelection,
  fields: Record<string, string> = {},
): FormData {
  const body = new FormData();
  // RN FormData's installed getParts() accepts a URI part, unlike DOM Blob typing.
  body.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return body;
}
export async function shareDownload(
  download: BinaryDownload,
  current: () => boolean,
  track?: TrackTemporary,
): Promise<void> {
  const { bytes, content_type } = download;
  if (!current()) throw new Error("Family Tree session changed.");
  if (
    !["application/json", "application/zip"].includes(content_type) ||
    !bytes.byteLength ||
    bytes.byteLength > EXPORT_LIMIT
  )
    throw new Error("Unsupported or oversized logical export.");
  if (!(await isAvailableAsync()))
    throw new Error("Native sharing is unavailable on this device.");
  if (!current()) throw new Error("Family Tree session changed.");
  const owned = temporary(),
    untrack = track?.(owned.release);
  try {
    const file = new File(
      owned.dir,
      `family-tree.${content_type === "application/zip" ? "zip" : "json"}`,
    );
    file.create();
    file.write(new Uint8Array(bytes));
    if (!current()) throw new Error("Family Tree session changed.");
    await shareAsync(file.uri, {
      mimeType: content_type,
      dialogTitle: "Save or share Family Tree export",
    });
  } finally {
    owned.release();
    untrack?.();
  }
}
