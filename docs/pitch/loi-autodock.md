# Letter of Intent: Pilot Integration (Non-Binding)

**Date:** [date]

**From:** [Your name], [Your team or company], [email], [phone]
**To:** [Contact name], AutoDock AI, Kozhikode, Kerala

## Purpose

We have built a decision layer for AutoDock rotary parking and EV charging towers. For every car it decides which tower and pallet to use, whether to charge now (drawing rooftop solar first) or wait for off-peak power, the price for the slot, and whether a plate read or payment needs a human check. Each decision comes with a calibrated confidence. Confident decisions act on their own; uncertain ones go to an operator. If the decision service is unavailable, simple rules take over.

This letter records our shared interest in testing that layer with AutoDock towers.

## What we propose

1. **Integration study (4 weeks).** We map the layer onto AutoDock's tower controller and Laan AI interfaces, using AutoDock-provided event data or a shared simulator. No change to tower safety systems.
2. **Shadow pilot (8 weeks) at one Kerala site.** The layer runs alongside the existing system and logs what it would have decided, without controlling anything. We compare waiting time, kWh delivered, revenue per bay and grid peak against current operation.
3. **Review.** If the shadow results are good, both parties discuss a controlled live pilot under a separate agreement.

## What each party would contribute

| AutoDock AI | [Your team] |
|---|---|
| Interface documentation and a technical contact | The decision layer, its operator panel and the audit log |
| Read-only access to tower events, or sample data | Integration engineering and the results report |
| Help choosing the pilot site | All decision-service costs during the pilot |

## Terms

- This letter is **non-binding**. It creates no obligation to sign a further agreement, pay, or supply anything.
- Each party keeps its own intellectual property. Data shared for the pilot is used only for the pilot and kept confidential.
- Either party may end these discussions at any time by email.

## Signatures

| | |
|---|---|
| **AutoDock AI** | **[Your team or company]** |
| Name: | Name: [Your name] |
| Title: | Title: |
| Signature: | Signature: |
| Date: | Date: |
