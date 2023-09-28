import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

import { useRefWithAutoFocus } from '../../../../shared/hooks/use-ref-with-auto-focus'

import { useFileTreeActionable } from '../../contexts/file-tree-actionable'

function FileTreeItemName({ name, isSelected, setIsDraggable }) {
  const { isRenaming, startRenaming, finishRenaming, error, cancel } =
    useFileTreeActionable()

  const isRenamingEntity = isRenaming && isSelected && !error

  useEffect(() => {
    setIsDraggable(!isRenamingEntity)
  }, [setIsDraggable, isRenamingEntity])

  if (isRenamingEntity) {
    return (
      <InputName
        initialValue={name}
        finishRenaming={finishRenaming}
        cancel={cancel}
      />
    )
  }
  return (
    <DisplayName
      name={name}
      isSelected={isSelected}
      startRenaming={startRenaming}
    />
  )
}

FileTreeItemName.propTypes = {
  name: PropTypes.string.isRequired,
  isSelected: PropTypes.bool.isRequired,
  setIsDraggable: PropTypes.func.isRequired,
}

function DisplayName({ name, isSelected, startRenaming }) {
  const [clicksInSelectedCount, setClicksInSelectedCount] = useState(0)

  function onClick() {
    setClicksInSelectedCount(clicksInSelectedCount + 1)
    if (!isSelected) setClicksInSelectedCount(0)
  }

  function onDoubleClick() {
    // only start renaming if the button got two or more clicks while the item
    // was selected. This is to prevent starting a rename on an unselected item.
    // When the item is being selected it can trigger a loss of focus which
    // causes UI problems.
    if (clicksInSelectedCount < 2) return
    startRenaming()
  }

  return (
    <button
      className="item-name-button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <span>{name}</span>
    </button>
  )
}

DisplayName.propTypes = {
  name: PropTypes.string.isRequired,
  startRenaming: PropTypes.func.isRequired,
  isSelected: PropTypes.bool.isRequired,
}

function InputName({ initialValue, finishRenaming, cancel }) {
  const [value, setValue] = useState(initialValue)

  // The react-bootstrap Dropdown re-focuses on the Dropdown.Toggle
  // after a menu item is clicked, following the ARIA authoring practices:
  // https://www.w3.org/TR/wai-aria-practices/examples/menu-button/menu-button-links.html
  // To improve UX, we want to auto-focus to the input when renaming. We use
  // requestAnimationFrame to immediately move focus to the input after it is
  // shown
  const { autoFocusedRef } = useRefWithAutoFocus()

  function handleFocus(ev) {
    const lastDotIndex = ev.target.value.lastIndexOf('.')
    ev.target.setSelectionRange(0, lastDotIndex)
  }

  function handleChange(ev) {
    setValue(ev.target.value)
  }

  function handleKeyDown(ev) {
    if (ev.key === 'Enter') {
      finishRenaming(value)
    }
    if (ev.key === 'Escape') {
      cancel()
    }
  }

  function handleBlur() {
    finishRenaming(value)
  }

  return (
    <span className="rename-input">
      <input
        type="text"
        value={value}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        ref={autoFocusedRef}
      />
    </span>
  )
}

InputName.propTypes = {
  initialValue: PropTypes.string.isRequired,
  finishRenaming: PropTypes.func.isRequired,
  cancel: PropTypes.func.isRequired,
}

export default FileTreeItemName
