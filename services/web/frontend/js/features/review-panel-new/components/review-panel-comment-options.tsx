import ControlledDropdown from '@/shared/components/controlled-dropdown'
import MaterialIcon from '@/shared/components/material-icon'
import { FC, memo } from 'react'
import { Dropdown, MenuItem } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

const ReviewPanelCommentOptions: FC<{
  onEdit: () => void
  onDelete: () => void
}> = ({ onEdit, onDelete }) => {
  const { t } = useTranslation()

  return (
    <ControlledDropdown id="review-panel-comment-options" pullRight>
      <Dropdown.Toggle noCaret bsSize="small" bsStyle={null}>
        <MaterialIcon
          type="more_vert"
          className="review-panel-entry-actions-icon"
          accessibilityLabel={t('more_options')}
        />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <MenuItem onClick={onEdit}>{t('edit')}</MenuItem>
        <MenuItem onClick={onDelete}>{t('delete')}</MenuItem>
      </Dropdown.Menu>
    </ControlledDropdown>
  )
}

export default memo(ReviewPanelCommentOptions)
