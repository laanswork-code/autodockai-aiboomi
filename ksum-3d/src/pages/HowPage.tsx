import { useEffect, useRef, type ReactNode } from 'react'
import filmUrl from '../../../docs/demo/driver-journey.mp4'
import filmPoster from '../../../docs/demo/driver-journey-poster.jpg'
import results from '../../sim/results.json'
import { AUTO_THRESHOLD, type SimMetrics } from '../control/types.ts'
import { Link, NavLinks } from '../Nav.tsx'
import { CATEGORY_LABEL, KERALA, PROBLEMS, countBy } from './problems.ts'
import './pages.css'
import './how.css'

/** TypeSafe's published price per decision, as counted in server/jevUsage.ts. */
const USD_PER_DECISION = 0.00008
/**
 * Cars per m² of ground in the towers vs the surface strip, from spaceStats()
 * in src/lib/stats.ts (16.5 m² per car today, 1.43 in the towers). Copied, not
 * imported: that module pulls in three.js.
 */
const DENSITY_GAIN = 11.5
/** Mean Jev latency and call count from our decision server (/api/health, jev.avgLatencyMs), at the time of writing. */
const MEASURED_MS = 563
const MEASURED_CALLS = 211
const TYPESAFE_POST = 'https://typesafe.ai/blog/introducing-system-one-models-and-jev'

const pct = (x: number) => `${Math.round(x * 100)}%`
const inr = (x: number) => `₹${x.toLocaleString('en-IN')}`
const change = (a: number, b: number) => `${b < a ? '' : '+'}${Math.round(((b - a) / a) * 100)}%`

const rows = results.results as SimMetrics[]
const base = rows.find((r) => r.scenario === 'rush_hour' && r.policy === 'baseline')!
const jev = rows.find((r) => r.scenario === 'rush_hour' && r.policy === 'jev')!
const missed = (policy: string) => results.details.find((d) => d.scenario === 'rush_hour' && d.policy === policy)!.missedAnomalies

const keralaCount = PROBLEMS.filter((p) => KERALA.has(p.city)).length
const topCategories = countBy(PROBLEMS, (p) => p.category).slice(0, 4)
const byCity = countBy(PROBLEMS, (p) => p.city)
const cityCount = (c: string) => byCity.find(([k]) => k === c)?.[1] ?? 0
const keralaCities = byCity.filter(([c]) => KERALA.has(c) && c !== 'Kerala (other)')
/** Kerala as one row, then each named city outside it, then the rest of India. */
const regions: [string, number][] = [
  ['Kerala', keralaCount],
  ...byCity.filter(([c]) => !KERALA.has(c) && c !== 'India (other)'),
  ['Elsewhere in India', cityCount('India (other)')],
]
const topRegion = Math.max(...regions.map(([, n]) => n))

/** Sections fade up once as they scroll into view (CSS turns this off for reduced motion). */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const wrap = ref.current
    if (!wrap || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver((seen) => {
      for (const e of seen) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) }
    }, { root: wrap.closest('.page'), rootMargin: '0px 0px -8% 0px' })
    wrap.classList.add('how--reveal')
    wrap.querySelectorAll('.how-sec').forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])
  return ref
}

function Section({ n, title, lead, children }: { n: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section className="how-sec" aria-labelledby={`how-${n}`}>
      <p className="how-num">{n}</p>
      <h2 id={`how-${n}`}>{title}</h2>
      {lead && <p className="how-lead">{lead}</p>}
      {children}
    </section>
  )
}

/** The story of AutoDock and its agent: problem, a day on site, the agent framework on Jev, the pipeline, the guardrails and the outcome. */
export default function HowPage() {
  const ref = useReveal()
  return (
    <div className="page">
      <div className="page__bar" />
      <div className="page__wrap how" ref={ref}>
        <header className="page__head">
          <div className="page__title">
            <p className="kicker">AutoDock · how it works</p>
            <h1>How it works</h1>
            <p className="sub">Rotary towers that park and charge, and a decision layer that knows when to ask a person.</p>
          </div>
          <NavLinks />
        </header>

        <section className="how-film" aria-label="Driver journey film">
          <video src={filmUrl} poster={filmPoster} controls playsInline preload="none" />
          <p className="how-film__cap">The driver journey in the digital twin: 1 min 17 s.</p>
        </section>

        <section className="how-hero" aria-label="The problem and the answer">
          <h2 className="how-hero__h">Kerala and India are running out of parking.</h2>
          <p className="how-hero__pos">
            We are building the AI intelligence layer for smart parking, and for the autonomous parking infrastructure
            that comes next.
          </p>
          <p className="how-hero__p">
            We found {PROBLEMS.length} real parking complaints: {keralaCount} in Kerala, the rest from Delhi NCR, Mumbai,
            Bengaluru and cities across India. AutoDock rotary towers hold 20 cars each, with a 7.4 kW charger on every
            pallet, and our proprietary agent framework, built on top of TypeSafe's Jev, decides where each car goes, when
            it charges and what it pays. One example site: two towers
            on 4 of the 15 bays at KSUM, Kalamassery park 40 cars where 4 park today.
          </p>
          <div className="how-cta">
            <Link to="/" className="how-btn how-btn--primary">See it live</Link>
            <Link to="/problems" className="how-btn">See the problems</Link>
          </div>
        </section>

        <Section n="01" title="The problem" lead="Kerala and the rest of India have more cars and EVs than parking or chargers, and no spare land in their cities to add either.">
          <div className="how-two how-two--even">
            <div className="panel">
              <h3>Where people complain</h3>
              <p className="hint">
                {PROBLEMS.length} real complaints from Reddit, forums and news. Kerala:{' '}
                {keralaCities.map(([c, n]) => `${c} ${n}`).join(', ')}, and {cityCount('Kerala (other)')} more across the state.
              </p>
              <ul className="bars">
                {regions.map(([region, n]) => (
                  <li key={region}>
                    <span>{region}</span>
                    <span className="track"><span className="fill" style={{ display: 'block', width: `${(n / topRegion) * 100}%` }} /></span>
                    <span className="val">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel">
              <h3>What they complain about</h3>
              <p className="hint">The biggest groups, Kerala and India together:</p>
              <ul className="bars">
                {topCategories.map(([cat, n]) => (
                  <li key={cat}>
                    <span>{CATEGORY_LABEL[cat] ?? cat}</span>
                    <span className="track"><span className="fill" style={{ display: 'block', width: `${(n / topCategories[0][1]) * 100}%` }} /></span>
                    <span className="val">{n}</span>
                  </li>
                ))}
              </ul>
              <p className="how-more"><Link to="/problems">Read all {PROBLEMS.length} problems</Link></p>
            </div>
          </div>
          <h3 className="how-eg">One example: KSUM, Kalamassery</h3>
          <div className="how-two">
            <div className="panel how-site">
              <h3>At KSUM / KINFRA today</h3>
              <ul className="how-facts">
                <li><b>15</b><span>surface bays, full by mid-morning</span></li>
                <li><b>0</b><span>chargers</span></li>
                <li><b>2</b><span>errands: park here, charge somewhere else</span></li>
              </ul>
              <p className="how-note">Drivers circle, park on the road, or leave.</p>
            </div>
            <div className="panel">
              <h3>Why this site</h3>
              <p>
                The Kerala Startup Mission building (KTIZ) at KINFRA Hi-Tech Park is the site we modelled as the digital
                twin and the pilot candidate. It is one car park, not the whole problem: the same towers are meant for
                crowded car parks in every city above.
              </p>
              <ul className="how-facts how-facts--light">
                <li><b>4</b><span>of the 15 bays given to two towers</span></li>
                <li><b>40</b><span>cars on those bays, each on a 7.4 kW charger</span></li>
              </ul>
            </div>
          </div>
        </Section>

        <Section n="02" title="A day at one site: KSUM" lead="What happens to the cars at the example site, taken from the scenarios you can play in the digital twin.">
          <ol className="how-day">
            <Moment t="08:45" title="Rush hour starts">
              12 cars in 35 minutes, chargers already busy, little sun yet. A Tata Nexon EV at 31% arrives: "Back by 6,
              need full charge." Before the drive, the driver connects the car in the app: it shares battery, range and
              location, and with the traffic one Jev request picks the pallet, the charge plan and the price. The booking
              ledger holds that pallet for the whole stay and never promises it twice. At the gate the camera recognises
              the car and its plate, and the tower turns the pallet to the door with nothing for the driver to tap.
            </Moment>
            <Moment t="08:49" title="A camera misreads a plate" tone="warn">
              The booking says KL 07 DE 5501, the camera reads KL 07 DF 5501 and is only 55% sure. Jev weighs a misread
              against a different car. If it flags the plate or is not sure, the car waits for the operator, who approves
              Jev's call or overrides it with the rules answer.
            </Moment>
            <Moment t="09:04" title="A nearly empty battery">
              A Tata Tiago EV at 12%: "Nearly empty, charge first please." Our agent has Jev read the note together with the battery,
              the stay and the grid headroom when it plans the charge.
            </Moment>
            <Moment t="09:08" title="A payment does not match" tone="warn">
              A UPI payment comes back as a mismatch. A flagged payment always goes to a person, however sure Jev is.
            </Moment>
            <Moment t="13:00" title="Power cut">
              A KSEB outage drops the grid limit to 15 kW and the site runs on rooftop solar and a small backup feed. Jev
              sees the solar and the headroom: cars that can wait hold for solar or the off-peak tariff, and a car that
              "will not make it home without a charge" is a case to charge now.
            </Moment>
            <Moment t="22:00" title="Overnight, off-peak">
              A robotaxi fleet comes back to the towers. The off-peak tariff has started, so the cars charge overnight,
              ready for the morning dispatch. The same checks still run: a fleet car whose payment does not match goes to the operator.
            </Moment>
          </ol>
          <p className="how-foot">Arrivals in the demo are scripted. Payment is a mock.</p>
        </Section>

        <Section n="03" title="Our agent framework, built on Jev" lead="Parking needs a decision for every car, fast and cheap, with an honest sense of how sure it is. Our agent framework owns the bookings, the guardrails, the operator queue and the audit; underneath, Jev gives it fast, typed, calibrated answers.">
          <div className="how-why">
            <div className="panel">
              <h3>Answers, not essays</h3>
              <p>The model under our agent, Jev, does not write text. It picks from the options the agent gives it, or returns a probability, and the agent turns that into an action. There is nothing free-form to go wrong on screen.</p>
            </div>
            <div className="panel">
              <h3>Five questions, one request</h3>
              <ul className="how-q">
                <li><span>Which pallet</span><code>Choice</code></li>
                <li><span>When to charge</span><code>Choice</code></li>
                <li><span>How busy, for the price</span><code>Score</code></li>
                <li><span>Is the plate wrong</span><code>Noul</code></li>
                <li><span>Is the payment at risk</span><code>Noul</code></li>
              </ul>
            </div>
            <div className="panel">
              <h3>Cheap enough for every car</h3>
              <p className="how-big"><b>${USD_PER_DECISION.toFixed(5)}</b> a decision, in about half a second.</p>
              <p>The simulated rush-hour day makes {jev.decisions} decisions. At that price, about ${(jev.decisions * USD_PER_DECISION).toFixed(2)}.</p>
            </div>
            <div className="panel">
              <h3>It can say "I'm not sure"</h3>
              <p>Every answer comes with a calibrated confidence. When it is low, the decision goes to a person instead of guessing.</p>
            </div>
          </div>
        </Section>

        <Section n="04" title="Why we built on Jev, not a chat model" lead="Chat models write an answer one token at a time. Jev is TypeSafe's first System One model: unstructured state in, typed probabilistic decisions out. It gives up free text to do that.">
          <Versus />
        </Section>

        <Section n="05" title="How it works" lead="Every arrival travels the same path. The API key never leaves the server.">
          <Pipeline />
        </Section>

        <Section n="06" title="When it asks a person" lead="Only where a wrong call costs the driver or the site. Seconds and rupees never wait.">
          <div className="panel how-rules">
            <Rule name="Bay" when="Never waits, unless both towers are full" note="A pallet that is not ideal costs a few seconds of rotation." />
            <Rule name="Price" when="Never waits" note="A tier that is a step off costs a few rupees." />
            <Rule name="Charge" at={AUTO_THRESHOLD.charge} when={`Waits below ${pct(AUTO_THRESHOLD.charge)} confidence`} note="A car left uncharged costs the driver their trip." />
            <Rule name="Plate and payment" at={AUTO_THRESHOLD.anomaly} when={`Waits below ${pct(AUTO_THRESHOLD.anomaly)} confidence, and always when flagged`} note="A wrong car or an unpaid stay always reaches a person. Pending payments are flagged." />
          </div>
        </Section>

        <Section n="07" title="What it solves" lead={<>The same seeded rush hour, {base.cars} cars, with the rules policy and with our agent on Jev. <span className="tag-sim">SIMULATED</span></>}>
          <div className="how-out">
            <Outcome k="Grid peak" from={`${base.gridPeakKw} kW`} to={`${jev.gridPeakKw} kW`} delta={change(base.gridPeakKw, jev.gridPeakKw)} />
            <Outcome k="Energy cost" from={inr(base.energyCostInr)} to={inr(jev.energyCostInr)} delta={change(base.energyCostInr, jev.energyCostInr)} />
            <Outcome k="Missed plate or payment problems" from={String(missed('baseline'))} to={String(missed('jev'))} />
            <div className="how-tile how-tile--ground">
              <span className="how-tile__k">Ground</span>
              <b>{DENSITY_GAIN}×</b>
              <span className="how-tile__n">cars per m² on the tower bays, measured from the site model</span>
            </div>
          </div>
          <div className="how-trade">
            <h3>The honest trade-off</h3>
            <p>
              The agent waits for cheaper power, so it sells fewer kWh ({Math.round(base.kwhDelivered)} to {Math.round(jev.kwhDelivered)})
              and earns less ({inr(base.revenueInr)} to {inr(jev.revenueInr)}). More calls go to a person, so the average
              wait rises from {base.avgWaitMin} to {jev.avgWaitMin} min. Tariffs and behaviour are illustrative: this is a
              simulation, not a measurement. <Link to="/dashboard">All four scenarios</Link>
            </p>
          </div>
        </Section>

        <Section n="08" title="Why you can trust it">
          <ul className="how-trust">
            <li><b>Rules fallback.</b> If Jev errors, times out or answers in a shape we cannot read, a rules policy decides instead, through the same interface, and the screen says so.</li>
            <li><b>Audit log.</b> Every decision is written down with its inputs, its confidence and who made it.</li>
            <li><b>Typed answers.</b> Choices and probabilities only. Code owns the numbers, the thresholds and the actions.</li>
            <li><b>No surprise charges.</b> No real money moves: payment in the demo is a mock, and any payment that looks wrong waits for a person.</li>
          </ul>
        </Section>

        <section className="how-close" aria-label="Summary">
          <p className="how-close__line">Ten times the cars on the same ground, and a brain that asks when it is not sure.</p>
          <nav className="how-cta" aria-label="Next">
            <Link to="/" className="how-btn how-btn--primary">Digital twin</Link>
            <Link to="/dashboard" className="how-btn">Dashboard</Link>
            <Link to="/problems" className="how-btn">Problems</Link>
          </nav>
        </section>
      </div>
    </div>
  )
}

function Moment({ t, title, tone, children }: { t: string; title: string; tone?: 'warn'; children: ReactNode }) {
  return (
    <li className={tone ? `how-day__item is-${tone}` : 'how-day__item'}>
      <time className="how-day__t">{t}</time>
      <div>
        <h3>{title}{tone && <span className="how-ask">asks a person</span>}</h3>
        <p>{children}</p>
      </div>
    </li>
  )
}

function Rule({ name, when, note, at }: { name: string; when: string; note: string; at?: number }) {
  return (
    <div className="how-rule">
      <div className="how-rule__name">{name}</div>
      <div className="how-rule__when">
        <b>{when}</b>
        <span>{note}</span>
      </div>
      <div className="how-meter" aria-hidden="true">
        {at == null
          ? <div className="how-meter__fill how-meter__fill--all" />
          : <>
              <div className="how-meter__fill how-meter__fill--ask" style={{ width: `${at * 100}%` }} />
              <div className="how-meter__tick" style={{ left: `${at * 100}%` }} />
            </>}
      </div>
    </div>
  )
}

function Outcome({ k, from, to, delta }: { k: string; from: string; to: string; delta?: string }) {
  return (
    <div className="how-tile">
      <span className="how-tile__k">{k}</span>
      <b>{to}</b>
      <span className="how-tile__n">rules {from}{delta && <em> · {delta}</em>}</span>
    </div>
  )
}

/** Chat model vs Jev. Both columns are TypeSafe's figures from TYPESAFE_POST. */
const VERSUS: [string, string, string][] = [
  ['How it answers', 'In sequence, one token at a time', 'In parallel: every output in one query'],
  ['What comes back', 'A string you have to parse and validate', 'Typed values, picked from options defined in advance (up to 255)'],
  ['Type errors', 'Possible: the text can miss your schema', 'Cannot happen: the output always matches the schema'],
  ['Confidence', 'Not part of the answer', 'Calibrated on every output: higher confidence, higher accuracy'],
  ['Response time', '3 to 329 s', '70 to 500 ms'],
  ['Price per million tokens', 'Input $0.20 to $10, output about 5× more', 'Input $0.042, output free'],
]

function Versus() {
  return (
    <>
      <div className="panel how-vs">
        <table>
          <thead>
            <tr>
              <td />
              <th scope="col">Chat model<span>Autoregressive LLMs, e.g. the latest OpenAI and Anthropic models</span></th>
              <th scope="col" className="is-jev">Jev<span>TypeSafe's System One model, trained with RLCD</span></th>
            </tr>
          </thead>
          <tbody>
            {VERSUS.map(([k, llm, jev]) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                <td>{llm}</td>
                <td className="is-jev">{jev}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="how-vs__ours">
        <b>Measured here:</b> {MEASURED_MS} ms on average per request across {MEASURED_CALLS} live calls, five answers
        per request, about ${USD_PER_DECISION.toFixed(5)} a decision.
      </p>
      <p className="how-foot how-vs__src">
        Comparison figures are TypeSafe's. TypeSafe reports Jev 193.6× faster and 444.6× cheaper on its workflow evals.
        RLCD is Reinforcement Learning for Calibrated Decisions. Source: <a href={TYPESAFE_POST}>Introducing System One models and Jev</a>.
      </p>
    </>
  )
}

const STEPS = [
  { k: 'Arrival', d: 'The connected car sends battery, range and location; the app adds traffic, stay and payment; the booking ledger holds a pallet without overbooking; the gate camera recognises the plate.' },
  { k: 'Event bus', d: 'Each step publishes events and listens for the ones it needs.' },
  { k: 'Agent decision step', d: 'Our agent framework on the server, where the key stays. One Jev request, five answers.', jev: true },
  { k: 'Tower orchestrator', d: 'The only part that moves the towers: rotate, dock, charge.' },
  { k: 'Digital twin', d: 'The 3D towers, the control room and the driver phone.' },
]

function Pipeline() {
  return (
    <div className="panel how-pipe">
      <ol className="how-flow">
        {STEPS.map((s, i) => (
          <li key={s.k} className={s.jev ? 'how-node is-jev' : 'how-node'}>
            <span className="how-node__i">{i + 1}</span>
            <b>{s.k}</b>
            <span>{s.d}</span>
          </li>
        ))}
      </ol>
      <div className="how-branch">
        <div className="how-side">
          <b>Rules fallback</b>
          <span>On an error, a timeout or an unreadable answer, rules decide through the same interface.</span>
        </div>
        <div className="how-side is-warn">
          <b>Operator queue</b>
          <span>Unsure or flagged calls wait here. The operator approves, or overrides with the rules answer.</span>
        </div>
      </div>
    </div>
  )
}
