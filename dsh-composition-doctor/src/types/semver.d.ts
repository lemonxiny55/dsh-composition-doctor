declare module 'semver' {
  export interface SatisfiesOptions {
    includePrerelease?: boolean
  }

  export function satisfies(version: string, range: string, options?: SatisfiesOptions): boolean
}
