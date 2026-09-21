import { AppNavigation } from "@/components/app-navigation";
import { getCurrentUser } from "@/lib/auth/session";

export async function AppHeader() {
  const user = await getCurrentUser();
  return <AppNavigation userId={user?.id ?? null} />;
}
