# Bottom-up TAM / SAM / SOM — 2026-10-23

## Status

**No dollar TAM/SAM/SOM is reported.** The evidence corpus does not contain a current operator-by-city fleet census, depot count, vehicles per depot, automated-parking installed price, recurring software price, or credible adoption rate. Publishing a numeric total now would turn unknowns into invented facts.

## Bottom-up formulas

1. **Potential sites:** addressable operators × supported operating cities × relevant fleets per city × depots per fleet.
2. **TAM sites:** all US sites where a robotaxi operator or contracted fleet manager controls vehicle storage and charging.
3. **SAM sites:** TAM sites with compatible vehicles, parcel/zoning eligibility, sufficient electrical service, and an operator-approved integration path.
4. **SOM sites:** SAM sites × explicitly sourced or editable adoption share for each year.
5. **One-time revenue:** deployed sites × robotic parking hardware + depot construction/installation + charging hardware/installation.
6. **Annual recurring revenue:** deployed sites × software subscription + operations/service contract.

Keep construction, tower equipment, chargers, utility work, software, and operations/service as separate lines. Do not include general parking or non-robotaxi parking revenue.

## Evidence available

- Waymo stated it had more than 1,500 vehicles across San Francisco, Los Angeles, and Phoenix in May 2025; this is dated and not a current fleet census. [OPS-11](https://waymo.com/blog/2025/05/scaling-our-fleet-through-us-manufacturing)
- Lyft says its Nashville depot can support hundreds of AVs, but does not disclose the fleet or exact capacity. [OPS-01](https://www.lyft.com/blog/posts/flexdrive-nashville-av-depot)
- WGI's 2026 conventional structure median is $33,300 per space; it cannot substitute for robotaxi depot or tower pricing. [ECON-01](https://wginc.com/blog/2026-zweig-group-marketing-excellence-awards)
- AutoDock has no public price list; its terms classify products and specs as in development/indicative. [AD-03](https://autodockai.com/terms)

## Scenario inputs to collect

| Input | Conservative | Base | Aggressive | Status |
|---|---:|---:|---:|---|
| Verified addressable depots by year | unknown | unknown | unknown | Need operator/site census |
| Vehicles served per depot | unknown | unknown | unknown | Nashville description is not an active fleet count |
| Eligible share of sites | unknown | unknown | unknown | Requires site, vehicle, utility, and permitting review |
| Three-/five-year adoption | unknown | unknown | unknown | Requires interviews and procurement evidence |
| One-time price by line | unknown | unknown | unknown | No price or quote found |
| Annual software/service price | unknown | unknown | unknown | No price or contract found |

The full editable input register is `research/data/normalized/assumptions.csv`. Leave these cells blank until evidence or user-entered assumptions exist.
