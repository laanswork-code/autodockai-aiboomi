# Depot economics — 2026-10-23

## Sourced anchors

- Lyft/Flexdrive describes an 80,000-square-foot AV depot with dozens of fast chargers, maintenance bays, secure parts storage, and over 70 jobs. It does not publish construction, lease, charging, labor, utilization, or maintenance costs. [OPS-01](https://www.lyft.com/blog/posts/flexdrive-nashville-av-depot)
- WGI reports a 2026 US median conventional parking-structure cost of $33,300 per space ($98.75/sq ft) across 35 markets. This is not an automated depot quote. [ECON-01](https://wginc.com/blog/2026-zweig-group-marketing-excellence-awards)
- DOE says charger choice depends on duty cycles and compatibility; smart charging can use fleet schedule/state-of-charge and tariff data to reduce utility upgrades and charging expense. [ECON-02](https://afdc.energy.gov/vehicles/electric-fleets), [ECON-03](https://www.energy.gov/cmei/femp/smart-charge-management-applications-and-benefits-federal-fleets)

## Comparison model

| Cost or result | Conventional depot | AutoDock-style depot | Evidence status |
|---|---|---|---|
| Land / lease | Site-specific quote | Site-specific quote | Unknown |
| Structure / site works | Use WGI only as a broad structure benchmark | Site works plus tower foundation/structure | Partial benchmark; tower scope unknown |
| Parking equipment | Conventional stalls and staging | Automated tower / transfer equipment | Public vendor claims exist; installed price unknown |
| Chargers | Count, power, connector and duty cycle | Same, plus any robotic plug-in system | Nashville count and power undisclosed; AutoDock robotic charging unverified |
| Utility service / demand charges | Utility study and tariff | Utility study and tariff; load management may alter peak | Unknown per site |
| Staffing / service | Depot, maintenance and readiness roles | Any displaced work plus system attendants and service | Nashville has >70 announced roles; no cost or staffing baseline |
| Annual energy | kWh × tariff + demand charges | Same, with charging schedule effects | Unknown per operator/site |
| Throughput / retrieval | Measure arrival-to-ready and retrieval distributions | Must prove system throughput under peak demand | Unknown |
| Incremental capex | — | Automated option minus conventional alternative | Unknown |
| Payback | — | Incremental capex ÷ annual verified net savings | Not calculable from current evidence |

## Required inputs before payback

Collect fleet size, operating hours, arrival distribution, site area, land/lease, stalls, charger count/power, electrical service capacity, tariffs, demand charges, energy, labor hours, maintenance, vehicle downtime, peak queue and retrieval times. Get project-specific tower and charger quotes and a safety/certification plan. Do not use unverified AutoDock retrieval or capacity claims as model inputs. See `research/data/normalized/assumptions.csv`.
