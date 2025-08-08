import MaterialIcon from '@/shared/components/material-icon'
import { FC, memo, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
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
    <Dropdown align="end">
      <DropdownToggle
        tabIndex={0}
        as={ReviewPanelCommentDropdownToggleButton}
        id={`review-panel-comment-options-btn-${id}`}
      >
        <MaterialIcon
          type="more_vert"
          className="review-panel-entry-actions-icon"
          accessibilityLabel={t('more_options')}
        />
      </DropdownToggle>
      <DropdownMenu flip={false}>
        {canEdit && (
          <li role="none">
            <DropdownItem as="button" onClick={onEdit}>
              {t('edit')}
            </DropdownItem>
          </li>
        )}
        {canDelete && (
          <li role="none">
            <DropdownItem as="button" onClick={onDelete}>
              {t('delete')}
            </DropdownItem>
          </li>
        )}
      </DropdownMenu>
    </Dropdown>
  )
}

export default memo(ReviewPanelCommentOptions)
