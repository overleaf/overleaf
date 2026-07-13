import { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  OLDropdown,
  OLDropdownDivider,
  OLDropdownItem,
  OLDropdownMenu,
} from '@/shared/components/ol/ol-dropdown-menu'
import { useTabsContext } from '@/features/ide-react/context/tabs-context'

export function TabsContextMenu() {
  const { t } = useTranslation()
  const {
    tabs,
    closeTab,
    closeOtherTabs,
    closeToRight,
    contextMenuTarget,
    setContextMenuTarget,
  } = useTabsContext()

  const menuRef = useRef<HTMLDivElement>(null)

  // Close the context menu when opening another one
  useEffect(() => {
    if (!contextMenuTarget) return
    const handler = (event: MouseEvent) => {
      if (event.button !== 2) return
      const target = event.target as Element | null
      // Right-clicking another tab should re-open the menu on that tab;
      // its onContextMenu handler will set the new target.
      if (target?.closest('.context-menu')) return
      if (target?.closest('.editor-file-tab')) return
      setContextMenuTarget(null)
    }
    // Listen on mousedown (not contextmenu) so we still close when another
    // component's handler calls preventDefault on the contextmenu event.
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenuTarget, setContextMenuTarget])

  // Move focus to the menu on open, and back to the originating tab on close.
  const lastTabIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (contextMenuTarget) {
      lastTabIdRef.current = contextMenuTarget.tabId
      menuRef.current?.querySelector<HTMLElement>('[role="menu"]')?.focus()
    } else if (lastTabIdRef.current) {
      document
        .querySelector<HTMLElement>(`[data-tab-id="${lastTabIdRef.current}"]`)
        ?.focus()
      lastTabIdRef.current = null
    }
  }, [contextMenuTarget])

  if (!contextMenuTarget) return null

  const close = () => setContextMenuTarget(null)

  const handleKeyDown = (event: React.KeyboardEvent<Element>) => {
    if (event.key === 'Tab' || event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  const handleToggle = (wantOpen: boolean) => {
    if (!wantOpen) close()
  }

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={{ top: contextMenuTarget.top, left: contextMenuTarget.left }}
      className="context-menu"
    >
      <OLDropdown
        show
        drop="down"
        onKeyDown={handleKeyDown}
        onToggle={handleToggle}
      >
        <OLDropdownMenu className="dropdown-menu-sm-width" tabIndex={-1}>
          <OLDropdownItem
            disabled={tabs.length <= 1}
            as="button"
            onClick={() => {
              closeTab(contextMenuTarget.tabId)
              close()
            }}
          >
            {t('close')}
          </OLDropdownItem>
          <OLDropdownItem
            disabled={tabs.length <= 1}
            as="button"
            onClick={() => {
              closeOtherTabs(contextMenuTarget.tabId)
              close()
            }}
          >
            {t('close_other_tabs')}
          </OLDropdownItem>
          <OLDropdownItem
            disabled={tabs[tabs.length - 1]?.id === contextMenuTarget.tabId}
            as="button"
            onClick={() => {
              closeToRight(contextMenuTarget.tabId)
              close()
            }}
          >
            {t('close_tabs_to_the_right')}
          </OLDropdownItem>
          <OLDropdownDivider />
          <OLDropdownItem
            as="button"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('ui.toggle-settings', { detail: true })
              )
              // focus the tab setting
              window.dispatchEvent(
                new CustomEvent('ui.focus-setting', {
                  detail: 'editorTabs',
                })
              )
              close()
            }}
            leadingIcon="settings"
          >
            {t('tab_settings')}
          </OLDropdownItem>
        </OLDropdownMenu>
      </OLDropdown>
    </div>,
    document.body
  )
}
