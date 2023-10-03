import {
  FC,
  HTMLProps,
  PropsWithChildren,
  useEffect,
  useRef,
  useState,
} from 'react'
import Icon from '../../../../shared/components/icon'
import { Overlay, Popover } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { EditorView } from '@codemirror/view'
import { PastedContent } from '../../extensions/visual/pasted-content'
import useEventListener from '../../../../shared/hooks/use-event-listener'
import { FeedbackBadge } from '@/shared/components/feedback-badge'

const isMac = /Mac/.test(window.navigator?.platform)

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
  useEventListener('keydown', (event: KeyboardEvent) => {
    shiftRef.current = event.shiftKey
  })

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
        <Icon type="clipboard" fw />
        <Icon type="caret-down" fw />
      </button>

      {menuOpen && (
        <Overlay
          show
          onHide={() => setMenuOpen(false)}
          animation={false}
          container={view.scrollDOM}
          containerPadding={0}
          placement="bottom"
          rootClose
          target={toggleButtonRef.current ?? undefined}
        >
          <Popover
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
                  setMenuOpen(false)
                }}
              >
                <span style={{ visibility: formatted ? 'visible' : 'hidden' }}>
                  <Icon type="check" fw />
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
                  setMenuOpen(false)
                }}
              >
                <span style={{ visibility: formatted ? 'hidden' : 'visible' }}>
                  <Icon type="check" fw />
                </span>
                <span className="ol-cm-pasted-content-menu-item-label">
                  {t('paste_without_formatting')}
                </span>
                <span className="ol-cm-pasted-content-menu-item-shortcut">
                  {isMac ? '⇧⌘V' : 'Ctrl+Shift+V'}
                </span>
              </MenuItem>

              <MenuItem
                style={{ borderTop: '1px solid #eee' }}
                onClick={() => {
                  window.open(
                    'https://docs.google.com/forms/d/e/1FAIpQLSc7WcHrwz9fnCkUP5hXyvkG3LkSYZiR3lVJWZ0o6uqNQYrV7Q/viewform',
                    '_blank'
                  )
                  setMenuOpen(false)
                }}
              >
                <FeedbackBadge
                  id="paste-html-feedback"
                  url="https://docs.google.com/forms/d/e/1FAIpQLSc7WcHrwz9fnCkUP5hXyvkG3LkSYZiR3lVJWZ0o6uqNQYrV7Q/viewform"
                />
                <span className="ol-cm-pasted-content-menu-item-label">
                  {t('give_feedback')}
                </span>
              </MenuItem>
            </div>
          </Popover>
        </Overlay>
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
