import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

import { ApiClientError, apiClient } from "../api";

beforeEach(() => {
  vi.spyOn(apiClient, "getCurrentSession").mockRejectedValue(
    new ApiClientError(401, "Not authenticated.", { detail: "Not authenticated." }),
  );
});
