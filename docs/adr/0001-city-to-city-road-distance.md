# Use city-to-city road distance for automatic ride estimates

Automatic ride distance uses a driving route between the canonical origin and destination city reference coordinates, even when pickup or drop-off points are selected. We deliberately forgo pickup-level precision: changing a landmark alone does not recalculate distance, and the driver can override the estimate. Because stored distance also feeds price and completed-ride CO2 estimates, a future switch to pickup-based routing must distinguish previously stored city-based estimates rather than silently reinterpreting them.
