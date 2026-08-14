import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { apiClient } from "../api";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

const GENERIC_ACK = "If an eligible account exists for that address, reset instructions will arrive shortly.";

describe("ForgotPasswordPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits a parent email through the non-enumerating API and shows its generic acknowledgement", async () => {
    const requestPasswordReset = vi.spyOn(apiClient, "requestPasswordReset").mockResolvedValue({
      detail: GENERIC_ACK,
    });

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    const submit = screen.getByRole("button", { name: "Request Reset Link" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " Parent@Example.com " },
    });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(requestPasswordReset).toHaveBeenCalledWith({ email: "Parent@Example.com" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(GENERIC_ACK);
    expect(screen.getByLabelText("Email")).toHaveValue("");
  });
});
