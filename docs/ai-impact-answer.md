# AI Impact Statement: form answer

Paste-ready answer for the submission form. The full statement is in [AI_IMPACT.md](AI_IMPACT.md).

## Answer

We use AI to run smart parking towers that also charge electric cars.

When a car arrives, our AI (built on TypeSafe's Jev) decides four things in about half a second: which spot to put the car in, when to charge it, what price to charge, and whether the number plate or payment looks wrong. Each decision costs less than a hundredth of a cent.

The AI never acts alone when it is unsure. If it is not confident, or something looks wrong, a person checks it first. If the AI fails, simple backup rules take over, and every decision is recorded.

In our simulation, this cuts the peak load on the power grid by 29% and energy costs by 24%. It also fits 40 cars, each with a charger, in the space where 4 cars park today.

The data is safe to use: test bookings, public maps (OpenStreetMap) and public online posts about parking problems. We store no personal data, only demo number plates.

## One line

Our AI decides where each car parks, when it charges and what it pays in half a second; a person checks anything it is unsure about, and in simulation it cut grid peak by 29% and energy cost by 24%.
