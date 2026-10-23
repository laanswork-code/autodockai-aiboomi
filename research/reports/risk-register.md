# Technical and regulatory risk register — 2026-10-23

This is a diligence list, not legal or engineering advice. Vehicle operation permits, site/building permits, fire review, electrical interconnection, and equipment certification are separate workstreams.

| Area | Verified evidence | Open review question | Owner |
|---|---|---|---|
| AV permits and vehicle permissions | California DMV publishes testing/deployment permit categories; CPUC tracks passenger-service filings. Texas requires commercial driverless authorization; Arizona requires driverless-operation filings. | Does the exact operator, vehicle, city, and service type have the needed current authority? | Regulatory counsel and operator |
| Operator API access | No public AutoDock integration or operator API permission verified. | What dispatch, state-of-charge, vehicle identity, reservation, and readiness data can be shared? | Operator engineering and legal |
| Vehicle handoff | No independent evidence of safe autonomous vehicle entry/exit from AutoDock's system. | What is the safety boundary and manual recovery procedure? | Vehicle/OEM engineering and safety |
| Robotic charging | DOE says vehicle/charger compatibility must be checked; AutoDock's robotic plug-in is a company claim. | Connector, port location, interlocks, fault response, vehicle warranty, and certification? | OEM, charger vendor, electrical engineer |
| Fire/emergency | Model fire codes exist; Texas requires an emergency-services interaction plan for commercial driverless AV authorization. | Local access, shutdown, vehicle isolation, rescue, manual retrieval, and fire suppression requirements? | Fire protection engineer and AHJ |
| Building/accessibility | Adopted local building/fire code governs; the model code is not a parcel approval. | Structural, egress, accessible route, seismic, inspection, and existing-building requirements? | Architect, structural engineer, accessibility specialist |
| Zoning | San Francisco public record describes conditional-use review for fleet charging in specified PDR zoning contexts. | Is the proposed parcel allowed for fleet charging/storage, and what approvals apply? | Land-use counsel and planning department |
| Electrical service | PG&E offers a dedicated EV-service pathway; project eligibility is specific. | Available load, transformer/service work, interconnection date, tariff, and demand charges? | Utility and electrical engineer |
| Certification | UL offers EVSE safety/interoperability testing. | Which listings/certifications apply to the complete mechanical, electrical, software, and charging system? | AHJ, certification lab, insurer |
| Liability/insurance | No AutoDock US policy, warranty, or liability allocation verified. | Who bears vehicle damage, downtime, retrieval failure, charging fault, and bodily-injury exposure? | Legal, operator risk, insurer |
| Throughput/reliability | AutoDock site makes conflicting retrieval claims; no independent test data found. | What P95 retrieval, peak throughput, bypass, uptime, recovery, and maintenance targets are acceptable? | Operations and reliability engineering |
| Procurement/ownership | Flexdrive and Avis are disclosed partners for Waymo services. | Who owns the site and equipment, controls vehicles, pays capex, and can approve third-party systems? | Customer, depot partner, landlord, procurement |

The detailed machine-readable register is `research/data/normalized/risks.csv`.
