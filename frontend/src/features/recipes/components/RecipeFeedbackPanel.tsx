import type { FormEvent, ReactElement } from "react";

import type { Child, RecipeDetail } from "../../../api";
import { Button, FormField, TextInput } from "../../../ui";
import type { FeedbackReviewerType } from "../hooks/useRecipeDetail";

type RecipeFeedbackPanelProps = {
  childId: string;
  children: Child[];
  notes: string;
  onSave: () => Promise<void>;
  rating: string;
  recipe: RecipeDetail;
  reviewerType: FeedbackReviewerType;
  setChildId: (value: string) => void;
  setNotes: (value: string) => void;
  setRating: (value: string) => void;
  setReviewerType: (value: FeedbackReviewerType) => void;
  setVerdict: (value: string) => void;
  verdict: string;
};

export function RecipeFeedbackPanel({
  childId,
  children,
  notes,
  onSave,
  rating,
  recipe,
  reviewerType,
  setChildId,
  setNotes,
  setRating,
  setReviewerType,
  setVerdict,
  verdict,
}: RecipeFeedbackPanelProps): ReactElement {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void onSave();
  }

  return (
    <>
      <h2>Family Feedback</h2>
      <p>
        Average family rating: {recipe.feedback_summary.average_rating ?? "not rated"} ({recipe.feedback_summary.rating_count} ratings)
      </p>
      <form onSubmit={handleSubmit}>
        <FormField label="Feedback For">
          <select
            value={reviewerType}
            onChange={(event) =>
              setReviewerType(event.target.value as FeedbackReviewerType)
            }
          >
            <option value="PARENT">Parent</option>
            <option value="CHILD">Child</option>
          </select>
        </FormField>
        {reviewerType === "CHILD" ? (
          <FormField label="Child">
            <select
              value={childId}
              onChange={(event) => setChildId(event.target.value)}
            >
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}
        <FormField label="Family Rating">
          <TextInput
            type="number"
            min="1"
            max="5"
            value={rating}
            onChange={(event) => setRating(event.target.value)}
          />
        </FormField>
        <FormField label="Verdict">
          <TextInput
            value={verdict}
            onChange={(event) => setVerdict(event.target.value)}
            placeholder="Loved it, okay, too spicy..."
          />
        </FormField>
        <FormField label="Feedback Notes">
          <TextInput
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
        <Button type="submit">Save Feedback</Button>
      </form>
      {recipe.feedback.length > 0 ? (
        <ul>
          {recipe.feedback.map((row) => (
            <li key={row.id}>
              {row.reviewer_name}:{" "}
              {row.rating !== null ? `${row.rating}/5` : "not rated"}{" "}
              {row.verdict} {row.notes}
            </li>
          ))}
        </ul>
      ) : (
        <p>No family feedback yet.</p>
      )}
    </>
  );
}
