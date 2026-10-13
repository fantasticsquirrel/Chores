import { apiClient } from "../../../../api";
import type { TreeOperation } from "../../hooks/useTreeCommand";

/** Only non-secret, immutable receipt facts live in this retry executor. */
export function purgeOperation(
  personId: number,
  previewToken: string,
): TreeOperation {
  return (intent, options, authentication) => {
    if (authentication === undefined)
      throw new Error("Enter fresh owner authentication for this attempt.");
    return apiClient.commitFamilyTreePurge(
      personId,
      {
        ...intent,
        idempotency_key: intent.idempotency_key!,
        preview_token: previewToken,
        password: authentication,
      },
      options,
    );
  };
}
