import {
  FC,
  HTMLProps,
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { EditorView } from '@codemirror/view'
import { PastedContent } from '../../extensions/visual/pasted-content'
import useEventListener from '../../../../shared/hooks/use-event-listener'

import { sendMB } from '@/infrastructure/event-tracking'
import MaterialIcon from '@/shared/components/material-icon'
import OLOverlay from '@/shared/components/ol/ol-overlay'
import OLPopover from '@/shared/components/ol/ol-popover'
import { isMac } from '@/shared/utils/os'

export const PastedContentMenu: FC<{
  insertPastedContent: (
    view: EditorView,
    pastedContent: PastedContent,
    formatted: boolean
  ) => void
  pastedContent: PastedContent
  view: EditorView
  formatted: boolean
}> = ({ view, insertPastedContent, pastedContent, formatted }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null)
  const { t } = useTranslation()

  // record whether the Shift key is currently down, for use in the `paste` event handler
  const shiftRef = useRef(false)
  useEventListener(
    'keydown',
    useCallback((event: KeyboardEvent) => {
      shiftRef.current = event.shiftKey
    }, [])
  )

  // track interaction events
  const trackedEventsRef = useRef<Record<string, boolean>>({
    'pasted-content-button-shown': false,
    'pasted-content-button-click': false,
  })

  const trackEventOnce = useCallback((key: string) => {
    if (!trackedEventsRef.current[key]) {
      trackedEventsRef.current[key] = true
      sendMB(key)
    }
  }, [])

  useEffect(() => {
    if (menuOpen) {
      trackEventOnce('pasted-content-button-click')
    } else {
      trackEventOnce('pasted-content-button-shown')
    }
  }, [menuOpen, trackEventOnce])

  useEffect(() => {
    if (menuOpen) {
      const abortController = new AbortController()
      view.dom.addEventListener(
        'paste',
        event => {
          event.preventDefault()
          event.stopPropagation()
          insertPastedContent(view, pastedContent, !shiftRef.current)
          setMenuOpen(false)
        },
        { signal: abortController.signal, capture: true }
      )
      return () => {
        abortController.abort()
      }
    }
  }, [view, menuOpen, pastedContent, insertPastedContent])

  // TODO: keyboard navigation

  return (
    <>
      <button
        ref={toggleButtonRef}
        type="button"
        id="pasted-content-menu-button"
        aria-haspopup="true"
        aria-expanded={menuOpen}
        aria-controls="pasted-content-menu"
        aria-label={t('paste_options')}
        className="ol-cm-pasted-content-menu-toggle"
        tabIndex={0}
        onMouseDown={event => event.preventDefault()}
        onClick={() => setMenuOpen(isOpen => !isOpen)}
        style={{ userSelect: 'none' }}
      >
        <MaterialIcon type="content_copy" />
        <MaterialIcon type="expand_more" />
      </button>

      {menuOpen && (
        <OLOverlay
          show
          onHide={() => setMenuOpen(false)}
          transition={false}
          container={view.scrollDOM}
          containerPadding={0}
          placement="bottom"
          rootClose
          target={toggleButtonRef?.current}
        >
          <OLPopover
            id="popover-pasted-content-menu"
            className="ol-cm-pasted-content-menu-popover"
          >
            <div
              className="ol-cm-pasted-content-menu"
              id="pasted-content-menu"
              role="menu"
              aria-labelledby="pasted-content-menu-button"
            >
              <MenuItem
                onClick={() => {
                  insertPastedContent(view, pastedContent, true)
                  sendMB('pasted-content-menu-click', {
                    action: 'paste-with-formatting',
                  })
                  setMenuOpen(false)
                }}
              >
                <span style={{ visibility: formatted ? 'visible' : 'hidden' }}>
                  <MaterialIcon type="check" />
                </span>
                <span className="ol-cm-pasted-content-menu-item-label">
                  {t('paste_with_formatting')}
                </span>
                <span className="ol-cm-pasted-content-menu-item-shortcut">
                  {isMac ? '⌘V' : 'Ctrl+V'}
                </span>
              </MenuItem>

              <MenuItem
                onClick={() => {
                  insertPastedContent(view, pastedContent, false)
                  sendMB('pasted-content-menu-click', {
                    action: 'paste-without-formatting',
                  })
                  setMenuOpen(false)
                }}
              >
                <span style={{ visibility: formatted ? 'hidden' : 'visible' }}>
                  <MaterialIcon type="check" />
                </span>
                <span className="ol-cm-pasted-content-menu-item-label">
                  {t('paste_without_formatting')}
                </span>
                <span className="ol-cm-pasted-content-menu-item-shortcut">
                  {isMac ? '⇧⌘V' : 'Ctrl+Shift+V'}
                </span>
              </MenuItem>
            </div>
          </OLPopover>
        </OLOverlay>
      )}
    </>
  )
}

const MenuItem = ({
  children,
  ...buttonProps
}: PropsWithChildren<HTMLProps<HTMLButtonElement>>) => (
  <button
    {...buttonProps}
    type="button"
    role="menuitem"
    className="ol-cm-pasted-content-menu-item"
  >
    {children}
  </button>
)
