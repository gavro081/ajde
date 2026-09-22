import { OfferRideSkeleton } from "@/components/page-skeletons";

import { OfferRideHeading } from "./offer-heading";

export default function NewRideLoading() {
  return <OfferRideSkeleton heading={<OfferRideHeading />} />;
}
