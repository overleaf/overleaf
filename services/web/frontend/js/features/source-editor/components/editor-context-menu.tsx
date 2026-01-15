import { FC, Fragment, memo } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { getTooltip } from '@codemirror/view'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from './codemirror-context'
import { contextMenuStateField } from '../extensions/context-menu'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useContextMenuItems } from '../hooks/use-context-menu-items'

const EditorContextMenu: FC = () => {
  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()
  const editorContextMenuEnabled = useFeatureFlag('editor-context-menu')

  const menuState = state.field(contextMenuStateField, false)
  if (!editorContextMenuEnabled || !menuState?.tooltip) {
    return null
  }

  const tooltipView = getTooltip(view, menuState.tooltip)
  if (!tooltipView) {
    return null
  }

  return ReactDOM.createPortal(<EditorContextMenuContent />, tooltipView.dom)
}

const EditorContextMenuContent: FC = memo(function EditorContextMenuContent() {
  const { t } = useTranslation()

  const menuItems = useContextMenuItems()

  return (
    <div className="editor-context-menu" role="menu" aria-label={t('menu')}>
      {menuItems.map((menuItem, index) => (
        <Fragment key={index}>
          {menuItem.separatorAbove && (
            <div className="editor-context-menu-separator" />
          )}
          <ContextMenuItem
            label={menuItem.label}
            onClick={() => menuItem.handler()}
            disabled={menuItem.disabled}
            shortcut={menuItem.shortcut}
          />
        </Fragment>
      ))}
    </div>
  )
})

type ContextMenuItemProps = {
  label: string
  onClick: () => void
  disabled?: boolean
  shortcut?: string
}

const ContextMenuItem: FC<ContextMenuItemProps> = ({
  label,
  shortcut,
  onClick,
  disabled,
}) => (
  <button
    type="button"
    role="menuitem"
    className="editor-context-menu-item"
    onClick={onClick}
    disabled={disabled}
  >
    <span className="editor-context-menu-item-label">{label}</span>
    <span className="editor-context-menu-item-shortcut">{shortcut ?? ''}</span>
  </button>
)

export default EditorContextMenu
