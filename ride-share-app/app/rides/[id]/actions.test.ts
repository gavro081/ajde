import { expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({guard:vi.fn(),create:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireCompleteProfile:state.guard}));
vi.mock("@/lib/supabase/server",()=>({createClient:state.create}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw new Error(url);}}));
import { requestBooking } from "./actions";
it("requires a complete contact profile before directly submitting a booking",async()=>{
 state.guard.mockRejectedValue(new Error("/onboarding"));
 await expect(requestBooking("92000000-0000-4000-8000-000000000001",new FormData())).rejects.toThrow("/onboarding");
 expect(state.create).not.toHaveBeenCalled();
});
