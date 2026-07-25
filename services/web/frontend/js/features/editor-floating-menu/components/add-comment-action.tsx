import { FC, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { sendMB } from '@/infrastructure/event-tracking'

const AddCommentAction: FC = () => {
  const { t } = useTranslation()
  const permissions = usePermissionsContext()

  const handleClick = useCallback(() => {
    sendMB('add-comment', { location: 'tooltip' })
    window.dispatchEvent(new Event('add-new-review-comment'))
  }, [])

  if (!permissions.comment) {
    return null
  }

  return (
    <OLTooltip
      id="editor-floating-menu-add-comment"
      description={t('add_comment')}
      overlayProps={{ placement: 'right' }}
    >
      <button
        className="editor-floating-menu-button"
        onClick={handleClick}
        aria-label={t('add_comment')}
      >
        <MaterialIcon type="chat" />
      </button>
    </OLTooltip>
  )
}

export default AddCommentAction
