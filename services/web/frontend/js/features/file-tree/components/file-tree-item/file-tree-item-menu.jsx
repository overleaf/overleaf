import { useRef } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

import Icon from '../../../../shared/components/icon'

import { useFileTreeMainContext } from '../../contexts/file-tree-main'

function FileTreeItemMenu({ id }) {
  const { t } = useTranslation()
  const { contextMenuCoords, setContextMenuCoords } = useFileTreeMainContext()
  const menuButtonRef = useRef()

  function handleClick(event) {
    event.stopPropagation()
    if (!contextMenuCoords) {
      const target = menuButtonRef.current.getBoundingClientRect()
      setContextMenuCoords({
        top: target.top + target.height / 2,
        left: target.right,
      })
    } else {
      setContextMenuCoords(null)
    }
  }

  return (
    <div className="menu-button btn-group">
      <button
        className="entity-menu-toggle btn btn-sm"
        id={`menu-button-${id}`}
        onClick={handleClick}
        ref={menuButtonRef}
      >
        <Icon type="ellipsis-v" accessibilityLabel={t('menu')} />
      </button>
    </div>
  )
}

FileTreeItemMenu.propTypes = {
  id: PropTypes.string.isRequired,
}

export default FileTreeItemMenu
