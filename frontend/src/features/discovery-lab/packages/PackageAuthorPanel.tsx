import { useCallback, useEffect, useRef, useState } from "react";
import type { DiscoveryPackagePayload } from "@family-manager/family-api/models";
import { apiClient } from "../../../api";
import { formatApiError } from "../../../lib/errors";
import { useDiscoveryRead } from "../hooks/useDiscoveryRead";
import { withAuthorizationDeadline } from "./packageCache";
import { PackagePreview } from "./PackageRuntime";
export function PackageAuthorPanel({
  identity,
  onPublished,
}: {
  identity: string;
  onPublished: () => void;
}) {
  const activeIdentity = useRef(identity);
  activeIdentity.current = identity;
  const mounted = useRef(true);
  const canApply = () => mounted.current && activeIdentity.current === identity;
  const busyRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const read = useCallback(() => apiClient.listDiscoveryPackages(), []);
  const list = useDiscoveryRead(identity, read);
  const [preview, setPreview] = useState<DiscoveryPackagePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!preview) return;
    let active = true;
    const verify = () => {
      void withAuthorizationDeadline(
        apiClient.previewDiscoveryPackage(
          preview.manifest.package_id,
          preview.manifest.version,
        ),
      ).catch(() => {
        if (active) {
          setPreview(null);
          setNotice(
            "Preview access could not be verified. Open it again after reconnecting.",
          );
        }
      });
    };
    const timer = setInterval(verify, 15000);
    window.addEventListener("focus", verify);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", verify);
    };
  }, [preview]);
  const action = async (work: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice("");
    try {
      await work();
    } catch (error) {
      if (canApply()) setNotice(formatApiError(error));
    } finally {
      busyRef.current = false;
      if (canApply()) setBusy(false);
    }
  };
  return (
    <section className="discovery-package-author">
      <h2>Author packages</h2>
      <p>
        Upload an immutable ZIP, inspect its exact version, then publish.
        Publishing any version, including a rollback, requires parents to
        approve that version for each child again. Uploaded code runs only on
        the web, not in the native app.
      </p>
      <label>
        Upload package ZIP
        <input
          aria-label="Upload package ZIP"
          type="file"
          accept=".zip,application/zip"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            event.target.value = "";
            void action(async () => {
              if (file.size > 8 * 1024 * 1024)
                throw new Error(
                  "ZIP must be 8 MiB or smaller. Legacy runtimes remain limited to 2 MiB.",
                );
              const bytes = new Uint8Array(await file.arrayBuffer());
              if (!canApply()) return;
              let binary = "";
              for (const b of bytes) binary += String.fromCharCode(b);
              const result = await apiClient.uploadDiscoveryPackage(
                btoa(binary),
              );
              if (!canApply()) return;
              setNotice(
                `Uploaded ${result.package_id} version ${result.version}. Preview it before publishing.`,
              );
              list.refresh();
            });
          }}
        />
      </label>
      {(notice || list.error) && <p role="status">{notice || list.error}</p>}
      {list.loading && <p>Loading package versions…</p>}
      <ul>
        {list.data?.map((item) => (
          <li key={`${item.package_id}:${item.version}`}>
            <strong>{item.package_id}</strong> · {item.version} · {item.runtime}{" "}
            {item.published ? "· Published" : ""}
            <div>
              <button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    const next = await apiClient.previewDiscoveryPackage(
                      item.package_id,
                      item.version,
                    );
                    if (canApply()) setPreview(next);
                  })
                }
              >
                Preview {item.version}
              </button>{" "}
              <button
                disabled={busy || item.published}
                onClick={() =>
                  void action(async () => {
                    await apiClient.publishDiscoveryPackage(
                      item.package_id,
                      item.version,
                    );
                    if (!canApply()) return;
                    onPublished();
                    setNotice(
                      `Published ${item.package_id} version ${item.version}. Review child access below.`,
                    );
                    list.refresh();
                  })
                }
              >
                Publish {item.version}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {preview && (
        <section aria-label="Package preview">
          <h3>
            {preview.manifest.exploration.title} · Preview{" "}
            {preview.manifest.version}
          </h3>
          <p>
            {preview.manifest.exploration.subject} · Grades{" "}
            {preview.manifest.exploration.grade_bands.join(" · ")} ·{" "}
            {preview.manifest.exploration.duration_minutes} minutes
          </p>
          <p>{preview.manifest.exploration.tags.join(" · ")}</p>
          <p>{preview.manifest.exploration.summary}</p>
          <p>{preview.manifest.exploration.question}</p>
          <PackagePreview payload={preview} />
          <p>{preview.manifest.exploration.explanation}</p>
          <p>{preview.manifest.exploration.misconception}</p>
          <ol>
            {preview.manifest.exploration.experiments.map((e) => (
              <li key={e.title}>
                <h4>{e.title}</h4>
                <p>{e.instruction}</p>
                <p>{e.observe}</p>
              </li>
            ))}
          </ol>
          <h4>Sources and references</h4>
          <ul>
            {preview.manifest.exploration.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
          <button onClick={() => setPreview(null)}>Close preview</button>
        </section>
      )}
    </section>
  );
}
