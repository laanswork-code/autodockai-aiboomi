// Copies the parking-problem research (../research/data/posts.json, built by the
// research pipeline) into the app as src/data/problems.json for the /problems page.
import { readFile, writeFile } from 'node:fs/promises'

const posts = JSON.parse(await readFile(new URL('../../research/data/posts.json', import.meta.url), 'utf8'))
const keep = posts.map(({ url, kind, source, date, engagement, title, snippet, city, category, problem, quote, related }) =>
  ({ url, kind, source, date, engagement, title, snippet, city, category, problem, quote, ...(related ? { related } : {}) }))
await writeFile(new URL('../src/data/problems.json', import.meta.url), JSON.stringify(keep))
console.log(`${keep.length} problems -> src/data/problems.json`)
