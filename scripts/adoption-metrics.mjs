// Public aggregate metadata only. No profile/log access; no telemetry or posting.
// node scripts/adoption-metrics.mjs YYYY-MM-DD [output.json]
import { writeFile } from 'node:fs/promises'

const date = process.argv[2]
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
  throw new Error('Supply the observation date as YYYY-MM-DD (your local calendar date).')
}
const day = (offset) => new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10)
const queries = {
  npm7d: `https://api.npmjs.org/downloads/point/${day(-7)}:${day(-1)}/dsh-composition-doctor`,
  npm30d: `https://api.npmjs.org/downloads/point/${day(-30)}:${day(-1)}/dsh-composition-doctor`,
  registry: 'https://registry.npmjs.org/dsh-composition-doctor',
  github: 'https://api.github.com/repos/lemonxiny55/dsh-composition-doctor',
}
const record = { observationDate: date, capturedAt: new Date().toISOString(),
  windowConvention: 'Complete days ending before observationDate; npm API date windows use UTC',
  sources: {}, npm: {}, github: null }
await Promise.all(Object.entries(queries).map(async ([key, url]) => {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'dsh-composition-doctor-adoption-record' }, signal: AbortSignal.timeout(20000) })
    record.sources[key] = { url, status: response.status }
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    if (key.startsWith('npm')) record.npm[key] = { downloads: data.downloads, start: data.start, end: data.end }
    else if (key === 'registry') record.npm.release = { latest: data['dist-tags'].latest, published040: data.time['0.4.0'], integrity040: data.versions['0.4.0'].dist.integrity }
    else record.github = { stars: data.stargazers_count, forks: data.forks_count,
      openIssuesAndPRs: data.open_issues_count, description: data.description, topics: data.topics }
  } catch (error) {
    record.sources[key] = { ...record.sources[key], url, error: error.message }
    if (key.startsWith('npm')) record.npm[key] = null
  }
}))
const json = `${JSON.stringify(record, null, 2)}\n`
if (process.argv[3]) await writeFile(process.argv[3], json)
console.log(json)
