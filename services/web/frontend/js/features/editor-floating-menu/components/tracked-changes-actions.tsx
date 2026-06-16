import { FC, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import {
  useRangesActionsContext,
  useRangesContext,
} from '@/features/review-panel/context/ranges-context'
import { numberOfChangesInSelection } from '@/features/review-panel/utils/changes-in-selection'
import { isInsertOperation } from '@/utils/operations'
import { captureException } from '@/infrastructure/error-reporter'

const TrackedChangesActions: FC = () => {
  const { t } = useTranslation()
  const view = useCodeMirrorViewContext()
  const state = useCodeMirrorStateContext()
  const permissions = usePermissionsContext()
  const ranges = useRangesContext()
  const { acceptChanges, rejectChanges } = useRangesActionsContext()
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
    const nChanges = numberOfChangesInSelection(
      ranges,
      view.state.selection.main
    )
    showGenericConfirmModal({
      message: t('confirm_accept_selected_changes', { count: nChanges }),
      title: t('accept_selected_changes'),
      onConfirm: async () => {
        try {
          await acceptChanges(...changesInSelection)
        } catch (err: any) {
          captureException(err)
        }
      },
      primaryVariant: 'danger',
    })
  }, [
    acceptChanges,
    changesInSelection,
    ranges,
    showGenericConfirmModal,
    view,
    t,
  ])

  const rejectChangesHandler = useCallback(() => {
    const nChanges = numberOfChangesInSelection(
      ranges,
      view.state.selection.main
    )
    showGenericConfirmModal({
      message: t('confirm_reject_selected_changes', { count: nChanges }),
      title: t('reject_selected_changes'),
      onConfirm: async () => {
        try {
          await rejectChanges(...changesInSelection)
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
    rejectChanges,
    changesInSelection,
  ])

  if (!permissions.comment || changesInSelection.length === 0) {
    return null
  }

  return (
    <>
      <div className="editor-floating-menu-divider" />
      <OLTooltip
        id="editor-floating-menu-accept-changes"
        description={t('accept_selected_changes')}
        overlayProps={{ placement: 'right' }}
      >
        <button
          className="editor-floating-menu-button"
          onClick={acceptChangesHandler}
          aria-label={t('accept_selected_changes')}
        >
          <MaterialIcon type="check" />
        </button>
      </OLTooltip>
      <OLTooltip
        id="editor-floating-menu-reject-changes"
        description={t('reject_selected_changes')}
        overlayProps={{ placement: 'right' }}
      >
        <button
          className="editor-floating-menu-button"
          onClick={rejectChangesHandler}
          aria-label={t('reject_selected_changes')}
        >
          <MaterialIcon type="clear" />
        </button>
      </OLTooltip>
    </>
  )
}

export default TrackedChangesActions
