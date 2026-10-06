import {afterEach,describe,expect,it,jest} from "@jest/globals";
import {fireEvent,render,screen} from "@testing-library/react-native";
import {Linking} from "react-native";
import {LoginScreen} from "./LoginScreen";
const mount = () => render(<LoginScreen apiBaseUrl="https://api.example.test" bootstrapError={null} onChildLogin={async()=>{}} onParentLogin={async()=>{}} />);
afterEach(()=>{jest.restoreAllMocks();});
describe("mobile public account entry parity",()=>{
  it("opens household registration through the exact hardened browser route",()=>{
    const open=jest.spyOn(Linking,"openURL").mockResolvedValue(undefined);
    mount();
    fireEvent.press(screen.getByRole("button",{name:"Create household account"}));
    expect(open).toHaveBeenCalledWith("https://family.multihost.ing/chore/register");
    fireEvent.press(screen.getByRole("button",{name:"Child"}));
    expect(screen.queryByRole("button",{name:"Create household account"})).toBeNull();
  });
  it("shows a recoverable error when a browser handoff fails",async()=>{
    jest.spyOn(Linking,"openURL").mockRejectedValue(new Error("unavailable"));
    mount();
    fireEvent.press(screen.getByRole("button",{name:"Forgot password?"}));
    expect(await screen.findByText("Could not open the browser. Please try again.")).toBeTruthy();
  });
});
