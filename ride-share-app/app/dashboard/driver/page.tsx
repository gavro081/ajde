import { redirect } from "next/navigation";

export default async function DriverDashboard({ searchParams }: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const notice = await searchParams;
  const query = new URLSearchParams({ view: "driver" });
  if (notice.success) query.set("success", notice.success);
  if (notice.error) query.set("error", notice.error);
  redirect(`/dashboard/trips?${query}`);
}
