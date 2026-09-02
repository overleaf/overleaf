import MaterialIcon from '@/shared/components/material-icon'
import { FC, memo, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  OLDropdown,
  OLDropdownItem,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import classnames from 'classnames'

const ReviewPanelCommentDropdownToggleButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>((props, ref) => (
  <button {...props} ref={ref} className={classnames(props.className, 'btn')} />
))
ReviewPanelCommentDropdownToggleButton.displayName =
  'ReviewPanelCommentDropdownToggleButton'

const ReviewPanelCommentOptions: FC<{
  onEdit: () => void
  onDelete: () => void
  id: string
  canEdit: boolean
  canDelete: boolean
}> = ({ onEdit, onDelete, id, canEdit, canDelete }) => {
  const { t } = useTranslation()

  if (!canEdit && !canDelete) {
    return null
  }

  return (
    <OLDropdown align="end">
      <OLDropdownToggle
        tabIndex={0}
        as={ReviewPanelCommentDropdownToggleButton}
        id={`review-panel-comment-options-btn-${id}`}
      >
        <MaterialIcon
          type="more_vert"
          className="review-panel-entry-actions-icon"
          accessibilityLabel={t('more_options')}
        />
      </OLDropdownToggle>
      <OLDropdownMenu flip={false}>
        {canEdit && (
          <li role="none">
            <OLDropdownItem as="button" onClick={onEdit}>
              {t('edit')}
            </OLDropdownItem>
          </li>
        )}
        {canDelete && (
          <li role="none">
            <OLDropdownItem as="button" onClick={onDelete}>
              {t('delete')}
            </OLDropdownItem>
          </li>
        )}
      </OLDropdownMenu>
    </OLDropdown>
  )
}

export default memo(ReviewPanelCommentOptions)
