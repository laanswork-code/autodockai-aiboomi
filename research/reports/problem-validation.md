# Problem validation — 2026-10-23

## What is supported

**Verified operating pattern.** Lyft says Flexdrive opened an 80,000-square-foot Nashville AV depot for Waymo vehicles with dozens of fast chargers, maintenance bays, secure parts storage, and over 70 full-time roles. Waymo separately says Flexdrive is its Nashville fleet-management partner. This establishes co-located charging, maintenance, parts, and fleet operations at one deployment. [OPS-01](https://www.lyft.com/blog/posts/flexdrive-nashville-av-depot), [OPS-02](https://waymo.com/blog/2026/04/your-waymo-ride-now-arriving-in-nashville/)

**Partner model.** Waymo's Dallas announcement names Avis for infrastructure, readiness, maintenance, and depot operations. Fleet operators may use third-party fleet-services companies rather than build every depot function themselves. [OPS-03](https://waymo.com/blog/2025/07/our-next-city-dallas/)

**Charging constraints.** DOE fleet guidance says charging design must match vehicle duty cycle and vehicle/charger compatibility; DC fast charging can reduce land and installation labor requirements relative to one Level 2 port per vehicle, but costs more. DOE smart-charge guidance requires operational and charger data such as schedules, state of charge, dwell, and rates. [ECON-02](https://afdc.energy.gov/vehicles/electric-fleets), [ECON-03](https://www.energy.gov/cmei/femp/smart-charge-management-applications-and-benefits-federal-fleets)

**Land and structure cost.** WGI reports a 2026 US median parking-structure construction cost of $33,300 per space ($98.75/sq ft). This is not a robotaxi-depot benchmark and does not price an automated tower. WGI's 2024 methodology explicitly excluded land acquisition and several soft costs; confirm the exact 2026 scope before modeling. [ECON-01](https://wginc.com/blog/2026-zweig-group-marketing-excellence-awards), [ECON-05](https://publications.wginc.com/parking-structure-cost-outlook-for-2024)

## What remains unknown

No operator-specific public data was found for parking occupancy, peak arrival queues, charging dwell, charge-port utilization, empty miles, idle time, repositioning, maintenance labor per vehicle, or unit-level cost. The Nashville announcement gives facility scope but no throughput or utilization. A managed-charging study for medium/heavy-duty trucks is an analogy, not a robotaxi result. [ECON-04](https://livewire.energy.gov/publication/1596)

No evidence establishes that a robotaxi depot should use vertical storage, that parking and charging should always be co-located, or that AutoDock's storage and retrieval claims improve total cost. ParkPlus reports automated parking projects and some charge-capable spaces, but not robotaxi operations or independent payback. [COMP-01](https://parkplusinc.com/projects/)

## Judgment

The **depot workflow problem is validated** for at least one scaled operator-partner relationship. The **space constraint is plausible but not quantified** for robotaxi depots. The **economic and technical value of robotic parking plus integrated charging remains an open hypothesis**. The cheapest next evidence is an operator interview and anonymized event-log study, not a physical installation.
