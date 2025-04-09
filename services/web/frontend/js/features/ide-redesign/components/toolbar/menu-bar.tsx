import {
  DropdownDivider,
  DropdownHeader,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { MenuBar } from '@/shared/components/menu-bar/menu-bar'
import { MenuBarDropdown } from '@/shared/components/menu-bar/menu-bar-dropdown'
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
import CommandDropdown, {
  CommandSection,
  MenuSectionStructure,
  MenuStructure,
} from './command-dropdown'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { useRailContext } from '../../contexts/rail-context'

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
        type: 'command',
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

  const editMenuStructure: MenuStructure = useMemo(
    () => [
      {
        id: 'edit-undo-redo',
        children: ['undo', 'redo'],
      },
      {
        id: 'edit-search',
        children: ['find', 'select-all'],
      },
    ],
    []
  )

  const insertMenuStructure: MenuStructure = useMemo(
    () => [
      {
        id: 'insert-latex',
        children: [
          {
            id: 'insert-math-group',
            title: t('math'),
            children: ['insert-inline-math', 'insert-display-math'],
          },
          'insert-symbol',
          {
            id: 'insert-figure-group',
            title: t('figure'),
            children: [
              'insert-figure-from-computer',
              'insert-figure-from-project-files',
              'insert-figure-from-another-project',
              'insert-figure-from-url',
            ],
          },
          'insert-table',
          'insert-citation',
          'insert-link',
          'insert-cross-reference',
        ],
      },
      {
        id: 'insert-comment',
        children: ['comment'],
      },
    ],
    [t]
  )

  const formatMenuStructure: MenuStructure = useMemo(
    () => [
      {
        id: 'format-text',
        children: ['format-bold', 'format-italics'],
      },
      {
        id: 'format-list',
        children: [
          'format-bullet-list',
          'format-numbered-list',
          'format-increase-indentation',
          'format-decrease-indentation',
        ],
      },
      {
        id: 'format-paragraph',
        title: t('paragraph_styles'),
        children: [
          'format-style-normal',
          'format-style-section',
          'format-style-subsection',
          'format-style-subsubsection',
          'format-style-paragraph',
          'format-style-subparagraph',
        ],
      },
    ],
    [t]
  )

  const pdfControlsMenuSectionStructure: MenuSectionStructure = useMemo(
    () => ({
      title: t('pdf_preview'),
      id: 'pdf-controls',
      children: [
        'view-pdf-presentation-mode',
        'view-pdf-zoom-in',
        'view-pdf-zoom-out',
        'view-pdf-fit-width',
        'view-pdf-fit-height',
      ],
    }),
    [t]
  )

  const {
    userSettings: { mathPreview },
    setUserSettings,
  } = useUserSettingsContext()

  const toggleMathPreview = useCallback(() => {
    setUserSettings(prev => {
      return {
        ...prev,
        mathPreview: !prev.mathPreview,
      }
    })
  }, [setUserSettings])

  const { setActiveModal } = useRailContext()
  const openKeyboardShortcutsModal = useCallback(() => {
    setActiveModal('keyboard-shortcuts')
  }, [setActiveModal])
  const openContactUsModal = useCallback(() => {
    setActiveModal('contact-us')
  }, [setActiveModal])
  return (
    <MenuBar
      className="ide-redesign-toolbar-menu-bar"
      id="toolbar-menu-bar-item"
    >
      <CommandDropdown menu={fileMenuStructure} title={t('file')} id="file" />
      <CommandDropdown menu={editMenuStructure} title={t('edit')} id="edit" />
      <CommandDropdown
        menu={insertMenuStructure}
        title={t('insert')}
        id="insert"
      />
      <MenuBarDropdown
        title={t('view')}
        id="view"
        className="ide-redesign-toolbar-dropdown-toggle-subdued ide-redesign-toolbar-button-subdued"
      >
        <ChangeLayoutOptions />
        <DropdownHeader>Editor settings</DropdownHeader>
        <MenuBarOption
          title={t('show_equation_preview')}
          trailingIcon={mathPreview ? 'check' : undefined}
          onClick={toggleMathPreview}
        />
        <CommandSection section={pdfControlsMenuSectionStructure} />
      </MenuBarDropdown>
      <CommandDropdown
        menu={formatMenuStructure}
        title={t('format')}
        id="format"
      />
      <MenuBarDropdown
        title={t('help')}
        id="help"
        className="ide-redesign-toolbar-dropdown-toggle-subdued ide-redesign-toolbar-button-subdued"
      >
        <MenuBarOption
          title={t('keyboard_shortcuts')}
          onClick={openKeyboardShortcutsModal}
        />
        <MenuBarOption
          title={t('documentation')}
          href="/learn"
          target="_blank"
          rel="noopener noreferrer"
        />
        <DropdownDivider />
        <MenuBarOption title={t('contact_us')} onClick={openContactUsModal} />
        <MenuBarOption
          title={t('give_feedback')}
          href="https://forms.gle/soyVStc5qDx9na1Z6"
          target="_blank"
          rel="noopener noreferrer"
        />
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
