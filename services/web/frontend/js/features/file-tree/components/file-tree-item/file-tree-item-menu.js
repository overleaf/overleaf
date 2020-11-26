import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import withoutPropagation from '../../../../infrastructure/without-propagation'

import { Dropdown } from 'react-bootstrap'
import Icon from '../../../../shared/components/icon'

import FileTreeItemMenuItems from './file-tree-item-menu-items'

function FileTreeItemMenu({ id }) {
  const { t } = useTranslation()

  const [dropdownOpen, setDropdownOpen] = useState(false)

  function handleToggle(wantOpen) {
    setDropdownOpen(wantOpen)
  }

  function handleClick() {
    handleToggle(false)
  }

  return (
    <Dropdown
      onClick={withoutPropagation(handleClick)}
      pullRight
      open={dropdownOpen}
      id={`dropdown-${id}`}
      onToggle={handleToggle}
    >
      <Dropdown.Toggle
        noCaret
        className="dropdown-toggle-no-background entity-menu-toggle"
        onClick={withoutPropagation()}
      >
        <Icon type="ellipsis-v" accessibilityLabel={t('menu')} />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <FileTreeItemMenuItems />
      </Dropdown.Menu>
    </Dropdown>
  )
}

FileTreeItemMenu.propTypes = {
  id: PropTypes.string.isRequired
}

export default FileTreeItemMenu
