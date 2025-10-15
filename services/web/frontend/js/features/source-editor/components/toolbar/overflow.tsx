import { FC, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import classnames from 'classnames'
import MaterialIcon from '@/shared/components/material-icon'
import { useCodeMirrorViewContext } from '../codemirror-context'
import OLOverlay from '@/shared/components/ol/ol-overlay'
import OLPopover from '@/shared/components/ol/ol-popover'

export const ToolbarOverflow: FC<
  React.PropsWithChildren<{
    overflowed: boolean
    overflowOpen: boolean
    setOverflowOpen: (open: boolean) => void
    overflowRef?: React.Ref<HTMLDivElement>
    popoverClassName?: string
  }>
> = ({
  overflowed,
  overflowOpen,
  setOverflowOpen,
  overflowRef,
  popoverClassName,
  children,
}) => {
  const { t } = useTranslation()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const keyboardInputRef = useRef(false)
  const view = useCodeMirrorViewContext()

  const className = classnames(
    'ol-cm-toolbar-button',
    'ol-cm-toolbar-overflow-toggle',
    {
      'ol-cm-toolbar-overflow-toggle-visible': overflowed,
    }
  )

  // A11y - Move the focus inside the popover to the first toolbar button when it opens
  const handlePopoverFocus = useCallback(() => {
    if (keyboardInputRef.current) {
      const firstToolbarItem = document.querySelector(
        '#popover-toolbar-overflow .ol-cm-toolbar-overflow button:not([disabled])'
      ) as HTMLButtonElement | null

      if (firstToolbarItem) {
        firstToolbarItem.focus()
      }
    }
  }, [])

  const handleKeyDown = useCallback(() => {
    keyboardInputRef.current = true
  }, [])

  const handleMouseDown = useCallback(() => {
    keyboardInputRef.current = false
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [handleKeyDown, handleMouseDown])

  // A11y - Move the focus back to the trigger when the popover is dismissed
  const handleCloseAndReturnFocus = useCallback(() => {
    setOverflowOpen(false)

    if (keyboardInputRef.current && buttonRef.current) {
      buttonRef.current.focus()
    }
  }, [setOverflowOpen])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        id="toolbar-more"
        className={className}
        aria-label={t('more_editor_toolbar_item')}
        aria-expanded={overflowOpen}
        aria-controls="popover-toolbar-overflow"
        onMouseDown={event => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={() => {
          setOverflowOpen(!overflowOpen)
        }}
      >
        <MaterialIcon type="more_horiz" />
      </button>

      <OLOverlay
        show={overflowOpen}
        target={buttonRef.current}
        placement="bottom"
        container={view.dom}
        // containerPadding={0}
        transition
        rootClose
        onHide={handleCloseAndReturnFocus}
        onEntered={handlePopoverFocus}
      >
        <OLPopover
          id="popover-toolbar-overflow"
          ref={overflowRef}
          role="toolbar"
        >
          <div
            className={classnames(popoverClassName, 'ol-cm-toolbar-overflow')}
          >
            {children}
          </div>
        </OLPopover>
      </OLOverlay>
    </>
  )
}
