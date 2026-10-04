import {describe,expect,it,jest} from "@jest/globals";
import {fireEvent,render,screen} from "@testing-library/react-native";
import {apiClient} from "../../api/client";
import {ChangePasswordScreen} from "./ChangePasswordScreen";

describe("password change session boundary",()=>{
 it("clears fields and exits the revoked session after success",async()=>{
   jest.spyOn(apiClient,"changePassword").mockResolvedValue(undefined);
   const cleared=jest.fn();
   render(<ChangePasswordScreen onPasswordChanged={cleared}/>);
   fireEvent.changeText(screen.getByPlaceholderText("Current password"),"current-test-password");
   fireEvent.changeText(screen.getByPlaceholderText("At least 15 characters"),"new-test-password-long");
   fireEvent.changeText(screen.getByPlaceholderText("Repeat new password"),"new-test-password-long");
   fireEvent.press(screen.getByText("Update Password"));
   await screen.findByText("Password changed. Sign in again.");
   expect(cleared).toHaveBeenCalledTimes(1);
   expect(screen.getByPlaceholderText("Current password").props.value).toBe("");
   expect(screen.getByPlaceholderText("At least 15 characters").props.value).toBe("");
 });
});
