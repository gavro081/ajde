import { FormPageSkeleton } from "@/components/page-skeletons";

export default function ImportLoading() {
  return <FormPageSkeleton width="max-w-xl" fields={2} title="Import a ride post" subtitle="Paste your post. Review the details before publishing." />;
}
