import ControlledDropdown from '@/shared/components/controlled-dropdown'
import MaterialIcon from '@/shared/components/material-icon'
import { FC, memo, forwardRef } from 'react'
import {
  Dropdown as BS3Dropdown,
  MenuItem as BS3MenuItem,
} from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
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
    <BootstrapVersionSwitcher
      bs3={
        <ControlledDropdown id={`review-panel-comment-options-${id}`} pullRight>
          <BS3Dropdown.Toggle
            tabIndex={0}
            noCaret
            bsSize="small"
            bsStyle={null}
          >
            <MaterialIcon
              type="more_vert"
              className="review-panel-entry-actions-icon"
              accessibilityLabel={t('more_options')}
            />
          </BS3Dropdown.Toggle>
          <BS3Dropdown.Menu>
            {canEdit && <BS3MenuItem onClick={onEdit}>{t('edit')}</BS3MenuItem>}
            {canDelete && (
              <BS3MenuItem onClick={onDelete}>{t('delete')}</BS3MenuItem>
            )}
          </BS3Dropdown.Menu>
        </ControlledDropdown>
      }
      bs5={
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
      }
    />
  )
}

export default memo(ReviewPanelCommentOptions)
