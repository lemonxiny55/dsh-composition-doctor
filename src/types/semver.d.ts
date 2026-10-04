declare module 'semver' {
  export interface SatisfiesOptions {
    includePrerelease?: boolean
  }

  export function satisfies(version: string, range: string, options?: SatisfiesOptions): boolean
  export function compare(left: string, right: string, options?: SatisfiesOptions): number
  export function valid(value: string): string | null
  export function validRange(value: string): string | null
}
