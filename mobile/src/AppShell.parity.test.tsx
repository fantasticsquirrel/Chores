import {afterEach,describe,expect,it,jest} from "@jest/globals";
import {render,screen} from "@testing-library/react-native";
jest.mock("react-native-safe-area-context",()=>require("react-native-safe-area-context/jest/mock").default);
import {AppShell} from "./AppShell";
import {useModules} from "./hooks/useModules";
import {useSessionBootstrap} from "./hooks/useSessionBootstrap";
jest.mock("./hooks/useModules"); jest.mock("./hooks/useSessionBootstrap");
jest.mock("./screens/recipes/RecipesScreen",()=>({RecipesScreen:()=>{const {Text}=require("react-native");return <Text>Native cookbook mounted</Text>;}}),{virtual:true});
jest.mock("./screens/notifications/NotificationsScreen",()=>({NotificationsScreen:()=>{const {Text}=require("react-native");return <Text>Native inbox mounted</Text>;}}),{virtual:true});
jest.mock("./screens/parent/ChildrenScreen",()=>({ChildrenScreen:()=>{const {Text}=require("react-native");return <Text>Children management mounted</Text>;}}));
const parent={user:{id:1,email:"qa@example.test",role:"PARENT" as const,household_id:1,child_id:null,is_household_owner:false},csrf_token:null};
afterEach(()=>{jest.clearAllMocks();jest.restoreAllMocks();});
function setup(tab:string,keys:string[],child=false){
 jest.mocked(useModules).mockReturnValue({modules:keys.map(key=>({key,name:key,description:key,can_manage:false})) as never,loadModules:jest.fn<()=>Promise<[]>>().mockResolvedValue([]),setModules:jest.fn()});
 jest.mocked(useSessionBootstrap).mockReturnValue({activeTab:tab,bootstrapping:false,bootstrapError:null,session:child?{...parent,user:{...parent.user,role:"CHILD",child_id:3}}:parent,setActiveTab:jest.fn(),handleParentLogin:jest.fn(),handleChildLogin:jest.fn(),handleLogout:jest.fn(),clearSession:jest.fn()} as never);
}
describe("native registered parity screens",()=>{
 it("mounts Recipes through actual shell when granted",()=>{setup("recipes",["recipes"]);render(<AppShell/>);expect(screen.getByText("Native cookbook mounted")).toBeTruthy();});
 it.each([false,true])("mounts granted inbox instead of falling through to Today child=%s",child=>{setup("notifications",["chores"],child);render(<AppShell/>);expect(screen.getByText("Native inbox mounted")).toBeTruthy();});
 it("does not mount child management after chores access is revoked",()=>{setup("children",[]);render(<AppShell/>);expect(screen.queryByText("Children management mounted")).toBeNull();});
});
