import { lstat, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import z from '@deepseek-ai/schemastery'

export const name = 'dsh-composition-doctor'
/** Public Cordis service dependency supplied by dsh-host-webserver. */
export const inject = ['webServer'] as const

/**
 * A deliberately small public configuration shape.  DSH's preview schema
 * loader accepts this object shape; keeping the type local also means the
 * package can be type-checked without importing preview-only host internals.
 */
export interface DoctorConfig {
  /** Directory owned by this plugin where CLI reports are written. */
  reportDir?: string
}

export const Config = z.object({ reportDir: z.string() })

interface WebRequest {
  method?: string
}

interface WebResponse {
  statusCode?: number
  setHeader(name: string, value: string): void
  end(body?: string): void
}

interface WebRoute {
  kind: 'exact'
  path: string
  /** Extra metadata is understood by the DSH preview host and is harmless to older hosts. */
  method: 'GET'
  handler(request: WebRequest, response: WebResponse): Promise<void>
}

interface WebServer {
  register(route: WebRoute): void | (() => void)
}

export interface DoctorContext {
  readonly webServer?: WebServer
  /** Cordis effect scope.  It is intentionally structural for preview compatibility. */
  effect?<T>(effect: () => T): T
}

export const latestReportPath = '/dsh-composition-doctor/reports/latest'

function reportDirectory(config: DoctorConfig): string {
  return resolve(config.reportDir ?? '.dsh-composition-doctor/reports')
}

function send(response: WebResponse, status: number, body: string): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(body)
}

async function latestReport(config: DoctorConfig): Promise<string | undefined> {
  const directory = reportDirectory(config)
  try {
    const directoryStat = await lstat(directory)
    if (!directoryStat.isDirectory()) return undefined
  } catch {
    return undefined
  }
  // The CLI writes report.json. latest.json is accepted for integrations that
  // copy a report into the plugin-owned directory under that conventional name.
  for (const filename of ['report.json', 'latest.json']) {
    try {
      const candidate = resolve(directory, filename)
      const fileStat = await lstat(candidate)
      if (!fileStat.isFile()) continue
      const text = await readFile(candidate, 'utf8')
      JSON.parse(text)
      return text.endsWith('\n') ? text : `${text}\n`
    } catch {
      // A missing or malformed report is represented as 404 below. Details are
      // not sent to the browser, so local paths and parser errors cannot leak.
    }
  }
  return undefined
}

function route(config: DoctorConfig): WebRoute {
  return {
    kind: 'exact',
    path: latestReportPath,
    method: 'GET',
    async handler(request, response) {
      if (request.method !== undefined && request.method.toUpperCase() !== 'GET') {
        response.statusCode = 405
        response.setHeader('Allow', 'GET')
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end('{"error":"method_not_allowed"}\n')
        return
      }
      const report = await latestReport(config)
      if (report === undefined) {
        send(response, 404, '{"error":"latest_report_not_found"}\n')
        return
      }
      send(response, 200, report)
    }
  }
}

/** Registers the one read-only report route inside a Cordis effect scope. */
export function apply(ctx: DoctorContext, config: DoctorConfig = {}): void | (() => void) {
  if (ctx.webServer === undefined) return undefined
  const register = () => ctx.webServer!.register(route(config))
  return ctx.effect === undefined ? register() : ctx.effect(register)
}
