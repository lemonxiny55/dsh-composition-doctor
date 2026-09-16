declare module 'react' {
  export function createElement(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown
  export function useEffect(effect: () => void | (() => void), dependencies?: readonly unknown[]): void
  export function useRef<T>(initial: T): { current: T }
}
