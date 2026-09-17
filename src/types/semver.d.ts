declare module 'semver' {
  export interface SatisfiesOptions {
    includePrerelease?: boolean
  }

  export function satisfies(version: string, range: string, options?: SatisfiesOptions): boolean
  export function compare(left: string, right: string, options?: SatisfiesOptions): number
}
