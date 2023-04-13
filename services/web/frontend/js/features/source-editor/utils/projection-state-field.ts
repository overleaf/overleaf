import { ChangeSet, StateField } from '@codemirror/state'
import {
  ProjectionItem,
  ProjectionResult,
  getUpdatedProjection,
  EnterNodeFn,
  ProjectionStatus,
} from './tree-operations/projection'

export function mergeChangeRanges(changes: ChangeSet) {
  let fromA = Number.MAX_VALUE
  let fromB = Number.MAX_VALUE
  let toA = Number.MIN_VALUE
  let toB = Number.MIN_VALUE
  changes.iterChangedRanges(
    (changeFromA, changeToA, changeFromB, changeToB) => {
      fromA = Math.min(changeFromA, fromA)
      fromB = Math.min(changeFromB, fromB)
      toA = Math.max(changeToA, toA)
      toB = Math.max(changeToB, toB)
    }
  )
  return { fromA, toA, fromB, toB }
}

/**
 * Creates a StateField to manage a 'projection' of the document. Type T is the subclass of
 * ProjectionItem that we will extract from the document.
 *
 * @param enterNode A function to call when 'enter'ing a node while traversing the syntax tree,
 *                  Used to identify nodes we are interested in, and create instances of T.
 */
export function makeProjectionStateField<T extends ProjectionItem>(
  enterNode: EnterNodeFn<T>
): StateField<ProjectionResult<T>> {
  const field = StateField.define<ProjectionResult<T>>({
    create(state) {
      const projection = getUpdatedProjection<T>(
        state,
        0,
        state.doc.length,
        0,
        state.doc.length,
        true,
        enterNode
      )
      return projection
    },
    update(currentProjection, transaction) {
      if (
        transaction.docChanged ||
        currentProjection.status !== ProjectionStatus.Complete
      ) {
        const { fromA, toA, fromB, toB } = mergeChangeRanges(
          transaction.changes
        )
        const list = getUpdatedProjection<T>(
          transaction.state,
          fromA,
          toA,
          fromB,
          toB,
          false,
          enterNode,
          transaction,
          currentProjection
        )
        return list
      }
      return currentProjection
    },
  })
  return field
}
