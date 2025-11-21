import { RailElement } from './rail-types'

export function shouldIncludeRailTab({ hide }: RailElement): boolean {
  if (typeof hide === 'function') {
    return !hide()
  }
  return !hide
}
