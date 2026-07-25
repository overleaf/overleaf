import { useCallback, useContext, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-context'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import {
  RangesActionsContext,
  useRangesContext,
} from '@/features/review-panel/context/ranges-context'
import { numberOfChangesInSelection } from '@/features/review-panel/utils/changes-in-selection'
import { isInsertOperation } from '@/utils/operations'
import { captureException } from '@/infrastructure/error-reporter'

export const useTrackedChangesActions = () => {
  const { t } = useTranslation()
  const view = useCodeMirrorViewContext()
  const state = useCodeMirrorStateContext()
  const ranges = useRangesContext()
  const rangesActions = useContext(RangesActionsContext)
  const { showGenericConfirmModal } = useModalsContext()

  const changesInSelection = useMemo(() => {
    return (ranges?.changes ?? []).filter(({ op }) => {
      const opFrom = op.p
      const opLength = isInsertOperation(op) ? op.i.length : 0
      const opTo = opFrom + opLength
      const selection = state.selection.main
      return opFrom >= selection.from && opTo <= selection.to
    })
  }, [ranges, state.selection.main])

  const acceptChangesHandler = useCallback(() => {
    if (!rangesActions) {
      return
    }
    const nChanges = numberOfChangesInSelection(
      ranges,
      view.state.selection.main
    )
    showGenericConfirmModal({
      message: t('confirm_accept_selected_changes', { count: nChanges }),
      title: t('accept_selected_changes'),
      onConfirm: async () => {
        try {
          await rangesActions.acceptChanges(...changesInSelection)
        } catch (err: any) {
          captureException(err)
        }
      },
      primaryVariant: 'danger',
    })
  }, [
    rangesActions,
    changesInSelection,
    ranges,
    showGenericConfirmModal,
    view,
    t,
  ])

  const rejectChangesHandler = useCallback(() => {
    if (!rangesActions) {
      return
    }
    const nChanges = numberOfChangesInSelection(
      ranges,
      view.state.selection.main
    )
    showGenericConfirmModal({
      message: t('confirm_reject_selected_changes', { count: nChanges }),
      title: t('reject_selected_changes'),
      onConfirm: async () => {
        try {
          await rangesActions.rejectChanges(...changesInSelection)
        } catch (err: any) {
          captureException(err)
        }
      },
      primaryVariant: 'danger',
    })
  }, [
    showGenericConfirmModal,
    t,
    ranges,
    view,
    rangesActions,
    changesInSelection,
  ])

  return { changesInSelection, acceptChangesHandler, rejectChangesHandler }
}
