import {
  DropdownDivider,
  DropdownHeader,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { MenuBar } from '@/shared/components/menu-bar/menu-bar'
import {
  MenuBarDropdown,
  NestedMenuBarDropdown,
} from '@/shared/components/menu-bar/menu-bar-dropdown'
import { MenuBarOption } from '@/shared/components/menu-bar/menu-bar-option'
import { useTranslation } from 'react-i18next'
import ChangeLayoutOptions from './change-layout-options'
import { MouseEventHandler, useCallback, useMemo } from 'react'
import { useIdeRedesignSwitcherContext } from '@/features/ide-react/context/ide-redesign-switcher-context'
import { useSwitchEnableNewEditorState } from '../../hooks/use-switch-enable-new-editor-state'
import MaterialIcon from '@/shared/components/material-icon'
import OLSpinner from '@/features/ui/components/ol/ol-spinner'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useCommandProvider } from '@/features/ide-react/hooks/use-command-provider'
import CommandDropdown, { MenuStructure } from './command-dropdown'

export const ToolbarMenuBar = () => {
  const { t } = useTranslation()
  const { setShowSwitcherModal } = useIdeRedesignSwitcherContext()
  const openEditorRedesignSwitcherModal = useCallback(() => {
    setShowSwitcherModal(true)
  }, [setShowSwitcherModal])
  const { setView, view } = useLayoutContext()

  useCommandProvider(
    () => [
      {
        label: t('show_version_history'),
        handler: () => {
          setView(view === 'history' ? 'editor' : 'history')
        },
        id: 'show_version_history',
      },
    ],
    [t, setView, view]
  )
  const fileMenuStructure: MenuStructure = useMemo(
    () => [
      {
        id: 'file-file-tree',
        children: ['new_file', 'new_folder', 'upload_file'],
      },
      { id: 'file-history', children: ['show_version_history'] },
      {
        id: 'file-download',
        children: ['download-as-source-zip', 'download-pdf'],
      },
    ],
    []
  )

  return (
    <MenuBar
      className="ide-redesign-toolbar-menu-bar"
      id="toolbar-menu-bar-item"
    >
      <CommandDropdown menu={fileMenuStructure} title={t('file')} id="file" />
      <MenuBarDropdown
        title={t('edit')}
        id="edit"
        className="ide-redesign-toolbar-dropdown-toggle-subdued ide-redesign-toolbar-button-subdued"
      >
        <MenuBarOption title="Undo" />
        <MenuBarOption title="Redo" />
        <DropdownDivider />
        <MenuBarOption title="Cut" />
        <MenuBarOption title="Copy" />
        <MenuBarOption title="Paste" />
        <MenuBarOption title="Paste without formatting" />
        <DropdownDivider />
        <MenuBarOption title="Find" />
        <MenuBarOption title="Select all" />
      </MenuBarDropdown>
      <MenuBarDropdown
        title={t('view')}
        id="view"
        className="ide-redesign-toolbar-dropdown-toggle-subdued ide-redesign-toolbar-button-subdued"
      >
        <ChangeLayoutOptions />
        <DropdownHeader>Editor settings</DropdownHeader>
        <MenuBarOption title="Show breadcrumbs" />
        <MenuBarOption title="Show equation preview" />
        <DropdownHeader>PDF preview</DropdownHeader>
        <MenuBarOption title="Presentation mode" />
        <MenuBarOption title="Zoom in" />
        <MenuBarOption title="Zoom out" />
        <MenuBarOption title="Fit to width" />
        <MenuBarOption title="Fit to height" />
      </MenuBarDropdown>
      <MenuBarDropdown
        title={t('insert')}
        id="insert"
        className="ide-redesign-toolbar-dropdown-toggle-subdued ide-redesign-toolbar-button-subdued"
      >
        <NestedMenuBarDropdown title="Math" id="math">
          <MenuBarOption title="Generate from text or image" />
          <DropdownDivider />
          <MenuBarOption title="Inline math" />
          <MenuBarOption title="Display math" />
        </NestedMenuBarDropdown>
        <MenuBarOption title="Symbol" />
        <NestedMenuBarDropdown title="Figure" id="figure">
          <MenuBarOption title="Upload from computer" />
          <MenuBarOption title="From project files" />
          <MenuBarOption title="From another project" />
          <MenuBarOption title="From URL" />
        </NestedMenuBarDropdown>
        <MenuBarOption title="Table" />
        <MenuBarOption title="Citation" />
        <MenuBarOption title="Link" />
        <MenuBarOption title="Cross-reference" />
        <DropdownDivider />
        <MenuBarOption title="Comment" />
      </MenuBarDropdown>
      <MenuBarDropdown
        title={t('format')}
        id="format"
        className="ide-redesign-toolbar-dropdown-toggle-subdued ide-redesign-toolbar-button-subdued"
      >
        <MenuBarOption title="Bold" />
        <MenuBarOption title="Italics" />
        <DropdownDivider />
        <MenuBarOption title="Bullet list" />
        <MenuBarOption title="Numbered list" />
        <MenuBarOption title="Increase indentation" />
        <MenuBarOption title="Decrease indentation" />
        <DropdownDivider />
        <DropdownHeader>Paragraph styles</DropdownHeader>
        <MenuBarOption title="Normal text" />
        <MenuBarOption title="Section" />
        <MenuBarOption title="Subsection" />
        <MenuBarOption title="Subsubsection" />
        <MenuBarOption title="Paragraph" />
        <MenuBarOption title="Subparagraph" />
      </MenuBarDropdown>
      <MenuBarDropdown
        title={t('help')}
        id="help"
        className="ide-redesign-toolbar-dropdown-toggle-subdued ide-redesign-toolbar-button-subdued"
      >
        <MenuBarOption title="Keyboard shortcuts" />
        <MenuBarOption title="Documentation" />
        <DropdownDivider />
        <MenuBarOption title="Contact us" />
        <MenuBarOption title="Give feedback" />
        <DropdownDivider />
        <SwitchToOldEditorMenuBarOption />
        <MenuBarOption
          title="What's new?"
          onClick={openEditorRedesignSwitcherModal}
        />
      </MenuBarDropdown>
    </MenuBar>
  )
}

const SwitchToOldEditorMenuBarOption = () => {
  const { loading, error, setEditorRedesignStatus } =
    useSwitchEnableNewEditorState()

  const disable: MouseEventHandler = useCallback(
    event => {
      // Don't close the dropdown
      event.stopPropagation()
      setEditorRedesignStatus(false)
    },
    [setEditorRedesignStatus]
  )
  let icon = null
  if (loading) {
    icon = <OLSpinner size="sm" />
  } else if (error) {
    icon = <MaterialIcon type="error" title={error} className="text-danger" />
  }
  return (
    <MenuBarOption
      title="Switch to old editor"
      onClick={disable}
      disabled={loading}
      trailingIcon={icon}
    />
  )
}
