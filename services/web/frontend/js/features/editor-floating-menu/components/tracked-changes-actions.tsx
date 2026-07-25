import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useTrackedChangesActions } from '@/features/review-panel/hooks/use-tracked-changes-actions'

const TrackedChangesActions: FC = () => {
  const { t } = useTranslation()
  const permissions = usePermissionsContext()
  const { changesInSelection, acceptChangesHandler, rejectChangesHandler } =
    useTrackedChangesActions()

  if (!permissions.write || changesInSelection.length === 0) {
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
