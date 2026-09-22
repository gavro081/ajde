# Student Ride Sharing

Students offer and find shared rides between cities, with the driver reviewing the trip details before publishing an offer.

## Language

**Ride offer**:
A driver's proposed trip with places available for passengers.
_Avoid_: Ride request, search query

**Ride draft**:
An unpublished ride offer whose details the driver can review and edit.
_Avoid_: Published ride, booking

**Ride description**:
Informal text written by a driver to describe one or more rides they intend to offer, or to correct a ride draft.
_Avoid_: Search query, imported post

**Imported post**:
An existing message from another service or group that describes a ride offer or ride request.
_Avoid_: Ride description, native ride offer

**Estimated driving distance**:
An editable estimate of a ride's road distance in kilometres, initially based on a route between its origin and destination cities. It does not describe exact pickup-to-drop-off travel.
_Avoid_: Straight-line distance, exact trip distance

**Saved car**:
A particular driver's recorded vehicle, including its model and fuel details.
_Avoid_: Catalog model, default car

**Catalog model**:
A vehicle variant with representative fuel and consumption details, available for a driver to identify their car. A model family such as Clio can have several catalog models.
_Avoid_: Saved car, driver's car

**Available seats**:
The passenger places a driver offers on a particular ride, which may be fewer than the car's passenger capacity.
_Avoid_: Car capacity, total occupants

**Departure time**:
The date and time a ride is intended to start, expressed in Skopje local time.
_Avoid_: Arrival time, device-local time
