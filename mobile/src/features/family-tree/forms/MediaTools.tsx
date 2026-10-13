import { useState } from "react";
import { Image, Text, View } from "react-native";
import type * as FT from "@family-manager/family-api/models";
import { ActionButton } from "../../../components/ActionButton";
import { TreeChoice, TreeTextField, TreeToggle } from "./NativeEditor";
import { shellStyles } from "../../../styles/shell";
import type { TreeTools } from "../hooks/useTreeTools";
import type { TreeState } from "../lib/workflows/state";
export function MediaTools({
  tools,
  state,
  onDirty,
}: {
  tools: TreeTools;
  state: TreeState;
  onDirty: (v: boolean) => void;
}) {
  const m = tools.media,
    r = tools.runtime,
    p = state.detail!.person;
  const [role, setRole] = useState<FT.FamilyTreeMediaRole>(
      m.attachmentReview?.role ?? "gallery",
    ),
    [story, setStory] = useState<number | null>(
      m.attachmentReview?.story_id ?? null,
    ),
    [remove, setRemove] = useState<FT.FamilyTreeMediaReference | null>(
      m.removalReview,
    ),
    [confirmed, setConfirmed] = useState(!!m.removalReview),
    [discard, setDiscard] = useState(false);
  const manager =
    state.access === "manage" &&
    state.collection?.capabilities.can_manage === true;
  const disabled =
    state.busy ||
    state.loading ||
    !!state.pending ||
    !manager ||
    (!m.pending &&
      (p.is_locked ||
        !!p.archived_at ||
        !!p.merged_into_person_id ||
        !!state.error));
  const task = (f: () => Promise<unknown>) => {
    void f().catch((e) => r.fail(e));
  };
  return (
    <View>
      <Text style={shellStyles.mutedText}>
        Photographs use private sanitized copies. JPEG/PNG/WebP, up to 10 MiB
        and 25 megapixels. Originals remain on your device. No remote-image
        fetching.
      </Text>
      <ActionButton
        label="Refresh photographs"
        disabled={state.busy || state.loading}
        onPress={() => task(() => m.load(p.id))}
      />
      {m.references.map((ref) => (
        <View key={ref.id}>
          <Text style={shellStyles.mutedText}>
            {ref.role} photograph #{ref.asset_id}
            {ref.story_id ? ` · story #${ref.story_id}` : ""} ·{" "}
            {ref.asset.caption}
          </Text>
          <ActionButton
            label={`View photograph #${ref.asset_id}`}
            disabled={state.busy || state.loading}
            onPress={() => task(() => m.view(ref.asset_id))}
          />
          {manager ? (
            <ActionButton
              label={`Remove photograph reference #${ref.id}`}
              disabled={disabled || m.pending}
              variant="danger"
              onPress={() => {
                setRemove(ref);
                setConfirmed(false);
                onDirty(true);
              }}
            />
          ) : null}
        </View>
      ))}
      {m.image ? (
        <>
          <Image
            accessibilityLabel="Authorized family photograph"
            source={{ uri: m.image }}
            style={{ width: "100%", height: 260 }}
            resizeMode="contain"
          />
          <ActionButton
            label="Hide photograph"
            onPress={() => {
              m.image = null;
              r.changed();
            }}
          />
        </>
      ) : null}
      {manager ? (
        <>
          <ActionButton
            label="Choose photograph"
            disabled={disabled || m.pending}
            onPress={() =>
              task(async () => {
                await m.choose();
                if (m.selected) onDirty(true);
              })
            }
          />
          <TreeTextField
            label="Photograph caption"
            value={m.caption}
            disabled={disabled || m.pending || !!m.uploaded}
            onChange={(v) => {
              m.caption = v;
              r.changed();
              onDirty(true);
            }}
          />
          <TreeChoice
            label="Photograph role"
            value={role}
            options={["primary", "gallery", "story"]}
            disabled={disabled || m.pending}
            onChange={(v) => {
              setRole(v as FT.FamilyTreeMediaRole);
              onDirty(true);
            }}
          />
          {role === "story" ? (
            <View>
              <Text style={shellStyles.mutedText}>
                Choose an available story for this photograph
              </Text>
              {state.stories?.items.map((s) => (
                <TreeToggle
                  key={s.id}
                  label={`Photograph for story ${s.title} (#${s.id})`}
                  value={story === s.id}
                  disabled={disabled || m.pending}
                  onChange={() => {
                    setStory(s.id);
                    onDirty(true);
                  }}
                />
              ))}
            </View>
          ) : null}
          {m.uploaded ? (
            <Text style={shellStyles.mutedText}>
              Uploaded sanitized asset #{m.uploaded.id}; retained for explicit
              attachment retry.
            </Text>
          ) : null}
          <ActionButton
            label={
              m.pending
                ? "Retry original photograph attachment"
                : "Upload and attach photograph"
            }
            disabled={
              disabled ||
              (!m.selected && !m.uploaded) ||
              (role === "story" && story === null)
            }
            onPress={() =>
              task(async () => {
                await m.attach(p.id, role, story);
                onDirty(false);
              })
            }
          />
          <ActionButton
            label="Discard photograph draft"
            disabled={state.busy}
            variant="secondary"
            onPress={() => setDiscard(true)}
          />
          {discard ? (
            <>
              <Text style={shellStyles.mutedText}>
                Discard this in-memory selection or uncertain attachment? An
                aborted request may already have committed.
              </Text>
              <ActionButton
                label="Keep photograph draft"
                onPress={() => setDiscard(false)}
              />
              <ActionButton
                label="Confirm discard photograph draft"
                variant="danger"
                onPress={() => {
                  m.discard();
                  setDiscard(false);
                  onDirty(false);
                }}
              />
            </>
          ) : null}
        </>
      ) : null}
      {remove ? (
        <>
          <TreeToggle
            label={`Confirm remove reference #${remove.id} from #${p.id}`}
            value={confirmed}
            disabled={state.busy}
            onChange={setConfirmed}
          />
          <ActionButton
            label="Confirm reference removal"
            variant="danger"
            disabled={disabled || !confirmed}
            onPress={() =>
              task(async () => {
                await m.remove(p.id, remove);
                setRemove(null);
                onDirty(false);
              })
            }
          />
          <ActionButton
            label="Keep photograph reference"
            disabled={state.busy || m.pending}
            onPress={() => {
              setRemove(null);
              setConfirmed(false);
              onDirty(false);
            }}
          />
        </>
      ) : null}
    </View>
  );
}
