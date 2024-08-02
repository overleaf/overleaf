import classnames from 'classnames'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '../codemirror-editor'
import {
  findCurrentSectionHeadingLevel,
  setSectionHeadingLevel,
} from '../../extensions/toolbar/sections'
import { useCallback, useMemo, useRef } from 'react'
import { Overlay, Popover } from 'react-bootstrap'
import useEventListener from '../../../../shared/hooks/use-event-listener'
import useDropdown from '../../../../shared/hooks/use-dropdown'
import { emitToolbarEvent } from '../../extensions/toolbar/utils/analytics'
import Icon from '../../../../shared/components/icon'
import { useTranslation } from 'react-i18next'

const levels = new Map([
  ['text', 'Normal text'],
  ['section', 'Section'],
  ['subsection', 'Subsection'],
  ['subsubsection', 'Subsubsection'],
  ['paragraph', 'Paragraph'],
  ['subparagraph', 'Subparagraph'],
])

const levelsEntries = [...levels.entries()]

export const SectionHeadingDropdown = () => {
  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()
  const { t } = useTranslation()

  const { open: overflowOpen, onToggle: setOverflowOpen } = useDropdown()

  useEventListener(
    'resize',
    useCallback(() => {
      setOverflowOpen(false)
    }, [setOverflowOpen])
  )

  const toggleButtonRef = useRef<HTMLButtonElement | null>(null)

  const currentLevel = useMemo(
    () => findCurrentSectionHeadingLevel(state),
    [state]
  )

  const currentLabel = currentLevel
    ? (levels.get(currentLevel.level) ?? currentLevel.level)
    : '---'

  return (
    <>
      <button
        ref={toggleButtonRef}
        type="button"
        id="section-heading-menu-button"
        aria-haspopup="true"
        aria-controls="section-heading-menu"
        aria-label={t('toolbar_choose_section_heading_level')}
        className="ol-cm-toolbar-menu-toggle"
        onMouseDown={event => event.preventDefault()}
        onClick={() => setOverflowOpen(!overflowOpen)}
      >
        <span>{currentLabel}</span>
        <Icon type="caret-down" fw />
      </button>

      {overflowOpen && (
        <Overlay
          show
          onHide={() => setOverflowOpen(false)}
          animation={false}
          container={view.dom}
          containerPadding={0}
          placement="bottom"
          rootClose
          target={toggleButtonRef.current ?? undefined}
        >
          <Popover
            id="popover-toolbar-section-heading"
            className="ol-cm-toolbar-menu-popover"
          >
            <div
              className="ol-cm-toolbar-menu"
              id="section-heading-menu"
              role="menu"
              aria-labelledby="section-heading-menu-button"
            >
              {levelsEntries.map(([level, label]) => (
                <button
                  type="button"
                  role="menuitem"
                  key={level}
                  onClick={() => {
                    emitToolbarEvent(view, 'section-level-change')
                    setSectionHeadingLevel(view, level)
                    view.focus()
                    setOverflowOpen(false)
                  }}
                  className={classnames(
                    'ol-cm-toolbar-menu-item',
                    `section-level-${level}`,
                    {
                      'ol-cm-toolbar-menu-item-active':
                        level === currentLevel?.level,
                    }
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </Popover>
        </Overlay>
      )}
    </>
  )
}
