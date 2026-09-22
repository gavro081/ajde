import { FormPageSkeleton } from "@/components/page-skeletons";

export default function ImportLoading() {
  return <FormPageSkeleton width="max-w-3xl" fields={2} backLink={false} title="Import a ride post" subtitle="Paste your post. Review the details before publishing." />;
}
