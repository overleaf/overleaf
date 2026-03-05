import { useState, useEffect, RefObject } from 'react'
import { useRefWithAutoFocus } from '../../../../shared/hooks/use-ref-with-auto-focus'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'

function FileTreeItemName({
  name,
  isSelected,
  setIsDraggable,
}: {
  name: string
  isSelected: boolean
  setIsDraggable: (isDraggable: boolean) => void
}) {
  const { isRenaming, finishRenaming, error, cancel } = useFileTreeActionable()

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
  return <DisplayName name={name} />
}

function DisplayName({ name }: { name: string }) {
  return (
    <div className="item-name">
      <span>{name}</span>
    </div>
  )
}

function InputName({
  initialValue,
  finishRenaming,
  cancel,
}: {
  initialValue: string
  finishRenaming: (value: string) => void
  cancel: () => void
}) {
  const [value, setValue] = useState(initialValue)

  // The react-bootstrap Dropdown re-focuses on the Dropdown.Toggle
  // after a menu item is clicked, following the ARIA authoring practices:
  // https://www.w3.org/TR/wai-aria-practices/examples/menu-button/menu-button-links.html
  // To improve UX, we want to auto-focus to the input when renaming. We use
  // requestAnimationFrame to immediately move focus to the input after it is
  // shown
  const { autoFocusedRef } = useRefWithAutoFocus()

  function handleFocus(ev: React.FocusEvent<HTMLInputElement>) {
    const lastDotIndex = ev.target.value.lastIndexOf('.')
    ev.target.setSelectionRange(0, lastDotIndex)
  }

  function handleChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setValue(ev.target.value)
  }

  function handleKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
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
        ref={autoFocusedRef as RefObject<HTMLInputElement>}
      />
    </span>
  )
}

export default FileTreeItemName
