import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FamilyTreeCollectionState, FamilyTreePerson } from "../../../api";
import { Button } from "../../../ui";
import { useTreeRuntime } from "../hooks/useTreeCommand";
import { FamilyTreeDialog } from "../components/FamilyTreeDialog";
import { MergeReview } from "./MergeReview";
import { PurgeReview } from "./PurgeReview";
import { LogicalExport } from "./LogicalExport";
import { AppendImport } from "./AppendImport";
import { DraftClose } from "./AdvancedFeedback";
export function TreeAdvancedTools({
  collection,
  person,
  people,
}: {
  collection: FamilyTreeCollectionState;
  person?: FamilyTreePerson;
  people: FamilyTreePerson[];
}) {
  const runtime = useTreeRuntime(),
    navigate = useNavigate();
  const [flow, setFlow] = useState<"transfer" | "merge" | "purge" | null>(null),
    [subject, setSubject] = useState<FamilyTreePerson | null>(null),
    [discard, setDiscard] = useState(false),
    [message, setMessage] = useState("");
  const dirty = useRef(false),
    cancel = useRef<(() => Promise<boolean>) | null>(null);
  const onDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const registerDiscard = useCallback(
    (value: (() => Promise<boolean>) | null) => {
      cancel.current = value;
    },
    [],
  );
  const authorized =
    runtime.authorizedManage === true && collection.capabilities.can_manage;
  useEffect(() => {
    if (!authorized) {
      setFlow(null);
      setSubject(null);
      dirty.current = false;
      cancel.current = null;
      setDiscard(false);
      setMessage("");
    }
  }, [authorized]);
  useEffect(() => {
    if (flow === "purge" && !collection.capabilities.can_purge) {
      setFlow(null);
      setSubject(null);
      dirty.current = false;
      setDiscard(false);
      setMessage(
        "Owner purge authority changed; the password and preview were discarded.",
      );
    }
  }, [flow, collection.capabilities.can_purge]);
  const blocked =
    !runtime.manage || !runtime.online || runtime.busy || runtime.checking;
  if (!authorized) return null;
  function open(next: NonNullable<typeof flow>) {
    if (blocked) return;
    dirty.current = false;
    cancel.current = null;
    setDiscard(false);
    setSubject(person ?? null);
    setFlow(next);
  }
  function close() {
    if (runtime.busy) return;
    if (dirty.current) {
      setDiscard(true);
      return;
    }
    setFlow(null);
    setSubject(null);
  }
  async function abandon() {
    if (runtime.busy) return;
    if (cancel.current && !(await cancel.current())) {
      setDiscard(false);
      return;
    }
    dirty.current = false;
    setDiscard(false);
    setFlow(null);
    setSubject(null);
  }
  const selected = person?.id === subject?.id ? person : subject;
  return (
    <section aria-label="Advanced Family Tree workflows">
      <details>
        <summary>Advanced record and transfer tools</summary>
        <p>
          Human-reviewed private media, duplicate merge, append import and
          logical export. No replacement, public sharing or offline writes.
        </p>
        <Button disabled={blocked} onClick={() => open("transfer")}>
          Import or export family tree
        </Button>
        {person && !person.archived_at && !person.merged_into_person_id ? (
          <Button
            disabled={blocked || person.is_locked}
            onClick={() => open("merge")}
          >
            Review duplicate and merge
          </Button>
        ) : null}
        {person && collection.capabilities.can_purge ? (
          <Button
            disabled={blocked || person.is_locked}
            onClick={() => open("purge")}
          >
            Permanently purge person
          </Button>
        ) : null}
      </details>
      <p role="status">{message}</p>
      <FamilyTreeDialog
        open={!!flow}
        title={
          flow === "merge"
            ? "Review duplicate and merge"
            : flow === "purge"
              ? "Owner-confirmed permanent purge"
              : "Import or export family tree"
        }
        onRequestClose={close}
      >
        <DraftClose
          discard={discard}
          onKeep={() => setDiscard(false)}
          onDiscard={() => void abandon()}
        />
        <div hidden={discard}>
          {flow === "merge" && selected ? (
            <MergeReview
              source={selected}
              people={people}
              onDirty={onDirty}
              onSaved={() => {
                dirty.current = false;
                setFlow(null);
                setMessage(
                  "Merge confirmed by exact alias and canonical-person readbacks. Open the canonical person to make further changes.",
                );
              }}
            />
          ) : null}
          {flow === "purge" && selected ? (
            <PurgeReview
              person={selected}
              canPurge={collection.capabilities.can_purge}
              onDirty={onDirty}
              onSaved={(notice) => {
                dirty.current = false;
                setFlow(null);
                setMessage(notice);
                navigate("/family-tree");
              }}
            />
          ) : null}
          {flow === "transfer" ? (
            <>
              <LogicalExport canExport={collection.capabilities.can_export} />
              <AppendImport
                onDirty={onDirty}
                registerDiscard={registerDiscard}
              />
            </>
          ) : null}
        </div>
      </FamilyTreeDialog>
    </section>
  );
}
