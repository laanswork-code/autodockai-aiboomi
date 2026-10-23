import raw from '../data/problems.json'

/** One parking problem from the research (see scripts/sync-problems.mjs). */
export interface Problem {
  url: string
  kind: 'reddit' | 'web' | 'news'
  source: string
  date: string
  engagement: string
  title: string
  snippet: string
  city: string
  category: string
  problem: string
  quote: string
  related?: { url: string; source: string }[]
}

export const PROBLEMS = raw as Problem[]

export const CATEGORY_LABEL: Record<string, string> = {
  'no-space': "Can't find a spot",
  'roadside-congestion': 'Roadside parking, jams',
  'fines-towing': 'Fines and towing',
  fees: 'Fees and overcharging',
  disputes: 'Fights and disputes',
  residential: 'Homes and apartments',
  hubs: 'Metro, station, mall, hospital',
  'ev-charging': 'EV charging',
  'failed-facilities': 'Parking that failed or sits unused',
}
export const KIND_LABEL = { all: 'All', reddit: 'Reddit', web: 'Forums', news: 'News' } as const
export const KERALA = new Set(['Kozhikode', 'Kochi', 'Thiruvananthapuram', 'Thrissur', 'Kerala (other)'])
export const CITIES = ['Kozhikode', 'Kochi', 'Thiruvananthapuram', 'Thrissur', 'Kerala (other)',
  'Bengaluru', 'Mumbai', 'Delhi NCR', 'Chennai', 'Hyderabad', 'Pune', 'India (other)']

/** Counts of `key` across items, largest first. */
export function countBy<T>(items: readonly T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>()
  for (const t of items) m.set(key(t), (m.get(key(t)) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1])
}
