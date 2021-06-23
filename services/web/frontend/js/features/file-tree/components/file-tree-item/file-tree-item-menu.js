import { useState } from 'react'
import { findDOMNode } from 'react-dom'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import withoutPropagation from '../../../../infrastructure/without-propagation'

import { Dropdown, Overlay } from 'react-bootstrap'
import Icon from '../../../../shared/components/icon'

import FileTreeItemMenuItems from './file-tree-item-menu-items'

function FileTreeItemMenu({ id }) {
  const { t } = useTranslation()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownTarget, setDropdownTarget] = useState()

  function handleToggle(wantOpen) {
    setDropdownOpen(wantOpen)
  }

  function handleClick() {
    handleToggle(false)
  }

  const toggleRef = component => {
    if (component) {
      // eslint-disable-next-line react/no-find-dom-node
      setDropdownTarget(findDOMNode(component))
    }
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
        ref={toggleRef}
      >
        <Icon type="ellipsis-v" accessibilityLabel={t('menu')} />
      </Dropdown.Toggle>
      <Overlay
        bsRole="menu"
        show={dropdownOpen}
        target={dropdownTarget}
        container={document.body}
      >
        <Menu dropdownId={`dropdown-${id}`} />
      </Overlay>
    </Dropdown>
  )
}

FileTreeItemMenu.propTypes = {
  id: PropTypes.string.isRequired,
}

function Menu({ dropdownId, style, className }) {
  return (
    <div className={`dropdown open ${className}`} style={style}>
      <ul className="dropdown-menu" role="menu" aria-labelledby={dropdownId}>
        <FileTreeItemMenuItems />
      </ul>
    </div>
  )
}

Menu.propTypes = {
  dropdownId: PropTypes.string.isRequired,
  style: PropTypes.object,
  className: PropTypes.string,
}

export default FileTreeItemMenu
