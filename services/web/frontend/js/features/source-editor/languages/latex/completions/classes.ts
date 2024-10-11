import { extendRequiredParameter } from './apply'
import { classNames } from './data/class-names'
import { Completions } from './types'

export function buildClassCompletions(completions: Completions) {
  for (const item of classNames) {
    completions.classes.push({
      type: 'cls',
      label: item,
      extend: extendRequiredParameter,
    })
  }
}
