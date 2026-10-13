import { apiClient, type FamilyTreePersonDetail } from "../../../api";
import { Button } from "../../../ui";
import { useTreeRuntime } from "../hooks/useTreeCommand";
import {
  confirmEditor,
  relationshipEditor,
  type EditorSpec,
} from "../lib/workflows/editors";
import { SafeMarkdown } from "./SafeMarkdown";
import { formatDate } from "../lib/workflows/personPresentation";
export function PersonRelationships({
  detail,
  choices,
  editable,
  onEdit,
  onSelect,
}: {
  detail: FamilyTreePersonDetail;
  choices: { id: number; label: string }[];
  editable: boolean;
  onEdit: (spec: EditorSpec) => void;
  onSelect: (id: number) => void;
}) {
  const runtime = useTreeRuntime();
  return (
    <section aria-label="Recorded relationships">
      <h3>Recorded relationships</h3>
      {detail.parent_links.length +
        detail.care_links.length +
        detail.partner_episodes.length ===
      0 ? (
        <p>No relationships recorded for this person.</p>
      ) : null}
      {detail.parent_links.map((link) => (
        <article key={`parent:${link.id}`}>
          <h4>
            {link.kind} parent relationship {link.id}
          </h4>
          <p>
            <Button onClick={() => onSelect(link.parent_person_id)}>
              Parent person {link.parent_person_id}
            </Button>{" "}
            →{" "}
            <Button onClick={() => onSelect(link.child_person_id)}>
              Child person {link.child_person_id}
            </Button>
          </p>
          <SafeMarkdown text={link.notes_md} />
          <p>
            {link.source_label} {link.source_url}
          </p>
          {runtime.manage ? (
            <>
              <Button
                disabled={!editable}
                onClick={() =>
                  onEdit(relationshipEditor("parent", link, choices))
                }
              >
                Edit parent relationship {link.id}
              </Button>
              <Button
                disabled={!editable}
                onClick={() =>
                  onEdit(
                    confirmEditor(
                      "Delete parent relationship",
                      `Remove only recorded parent relationship ${link.id}. Both people are retained.`,
                      (command, requestOptions) =>
                        apiClient.deleteFamilyTreeParentLink(
                          link.id,
                          command,
                          requestOptions,
                        ),
                    ),
                  )
                }
              >
                Delete parent relationship {link.id}
              </Button>
            </>
          ) : null}
        </article>
      ))}
      {detail.care_links.map((link) => (
        <article key={`care:${link.id}`}>
          <h4>
            {link.kind} care relationship {link.id}
          </h4>
          <p>
            <Button onClick={() => onSelect(link.caregiver_person_id)}>
              Caregiver person {link.caregiver_person_id}
            </Button>{" "}
            →{" "}
            <Button onClick={() => onSelect(link.recipient_person_id)}>
              Recipient person {link.recipient_person_id}
            </Button>
            ; {formatDate(link.start_date)} – {formatDate(link.end_date)}
          </p>
          <SafeMarkdown text={link.notes_md} />
          <p>
            {link.source_label} {link.source_url}
          </p>
          {runtime.manage ? (
            <>
              <Button
                disabled={!editable}
                onClick={() =>
                  onEdit(relationshipEditor("care", link, choices))
                }
              >
                Edit care relationship {link.id}
              </Button>
              <Button
                disabled={!editable}
                onClick={() =>
                  onEdit(
                    confirmEditor(
                      "Delete care relationship",
                      `Remove only recorded care relationship ${link.id}. Both people are retained.`,
                      (command, requestOptions) =>
                        apiClient.deleteFamilyTreeCareLink(
                          link.id,
                          command,
                          requestOptions,
                        ),
                    ),
                  )
                }
              >
                Delete care relationship {link.id}
              </Button>
            </>
          ) : null}
        </article>
      ))}
      {detail.partner_episodes.map((link) => (
        <article key={`partner:${link.id}`}>
          <h4>
            {link.kind} partnership {link.id} · {link.status}
          </h4>
          <p>
            <Button onClick={() => onSelect(link.person_a_id)}>
              Partner person {link.person_a_id}
            </Button>{" "}
            ↔{" "}
            <Button onClick={() => onSelect(link.person_b_id)}>
              Partner person {link.person_b_id}
            </Button>
            ; {formatDate(link.start_date)} – {formatDate(link.end_date)}
          </p>
          <SafeMarkdown text={link.notes_md} />
          <p>
            {link.source_label} {link.source_url}
          </p>
          {runtime.manage ? (
            <>
              <Button
                disabled={!editable}
                onClick={() =>
                  onEdit(relationshipEditor("partner", link, choices))
                }
              >
                Edit partnership {link.id}
              </Button>
              <Button
                disabled={!editable}
                onClick={() =>
                  onEdit(
                    confirmEditor(
                      "Delete partnership",
                      `Remove only recorded partnership episode ${link.id}. Both people are retained.`,
                      (command, requestOptions) =>
                        apiClient.deleteFamilyTreePartnerEpisode(
                          link.id,
                          command,
                          requestOptions,
                        ),
                    ),
                  )
                }
              >
                Delete partnership {link.id}
              </Button>
            </>
          ) : null}
        </article>
      ))}
    </section>
  );
}
