import { AnyOperation } from '../../../../../types/change'
import { SelectionRange } from '@codemirror/state'
import { visibleTextLength } from '@/utils/operations'

export const isFocused = (op: AnyOperation, range: SelectionRange): boolean => {
  return range.to >= op.p && range.from <= op.p + visibleTextLength(op)
}
