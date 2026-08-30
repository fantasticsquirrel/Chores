import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { apiClient } from "../api";
import { RegisterPage } from "./RegisterPage";

describe("RegisterPage", () => {
  afterEach(() => vi.restoreAllMocks());
  it("submits a pending household and shows email verification guidance", async () => {
    const request = vi.spyOn(apiClient, "requestRegistration").mockResolvedValue({ detail: "accepted" });
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Household name"), { target: { value: "Our Home" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse battery staple" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "correct horse battery staple" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({ email: "owner@example.com", household_name: "Our Home" })));
    expect(await screen.findByRole("status")).toHaveTextContent("Check your email");
  });
});
