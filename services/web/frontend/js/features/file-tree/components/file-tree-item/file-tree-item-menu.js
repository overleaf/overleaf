import { useState } from 'react'
import { findDOMNode } from 'react-dom'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import withoutPropagation from '../../../../infrastructure/without-propagation'

import { Button } from 'react-bootstrap'
import Icon from '../../../../shared/components/icon'

import { useFileTreeMainContext } from '../../contexts/file-tree-main'

function FileTreeItemMenu({ id }) {
  const { t } = useTranslation()

  const { contextMenuCoords, setContextMenuCoords } = useFileTreeMainContext()
  const [dropdownTarget, setDropdownTarget] = useState()

  function handleClick(_ev) {
    const target = dropdownTarget.getBoundingClientRect()
    if (!contextMenuCoords) {
      setContextMenuCoords({
        top: target.top + target.height / 2,
        left: target.right,
      })
    } else {
      setContextMenuCoords(null)
    }
  }

  const menuButtonRef = component => {
    if (component) {
      // eslint-disable-next-line react/no-find-dom-node
      setDropdownTarget(findDOMNode(component))
    }
  }

  return (
    <div className="menu-button btn-group">
      <Button
        className="entity-menu-toggle"
        bsSize="sm"
        id={`menu-button-${id}`}
        onClick={withoutPropagation(handleClick)}
        ref={menuButtonRef}
        bsStyle={null}
      >
        <Icon type="ellipsis-v" accessibilityLabel={t('menu')} />
      </Button>
    </div>
  )
}

FileTreeItemMenu.propTypes = {
  id: PropTypes.string.isRequired,
}

export default FileTreeItemMenu
