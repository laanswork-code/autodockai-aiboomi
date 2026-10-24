/** An Indian number plate: state code, district number, series letters, number. */
export const isPlate = (s: string) => /^[A-Z]{2} ?\d{1,2} ?[A-Z]{0,3} ?\d{1,4}$/.test(s)

const SERIES = 'ABCDEFGHJKLMNPRSTUVWXYZ' // no I or O, as on real plates

/** A Kerala plate: KL, a district code 01 to 86, a one or two letter series, four digits. */
export function randomPlate() {
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  const district = String(1 + Math.floor(Math.random() * 86)).padStart(2, '0')
  const series = pick(SERIES) + (Math.random() < 0.8 ? pick(SERIES) : '')
  const num = String(1 + Math.floor(Math.random() * 9999)).padStart(4, '0')
  return `KL ${district} ${series} ${num}`
}
