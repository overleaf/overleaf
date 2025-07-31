import {
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { MenuBar } from '@/shared/components/menu-bar/menu-bar'
import { MenuBarDropdown } from '@/shared/components/menu-bar/menu-bar-dropdown'
import { MenuBarOption } from '@/shared/components/menu-bar/menu-bar-option'
import { useTranslation } from 'react-i18next'
import ChangeLayoutOptions from './change-layout-options'
import { MouseEventHandler, useCallback, useMemo, useState } from 'react'
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
import { useRailContext } from '../../contexts/rail-context'
import WordCountModal from '@/features/word-count-modal/components/word-count-modal'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import { useSurveyUrl } from '../../hooks/use-survey-url'

export const ToolbarMenuBar = () => {
  const { t } = useTranslation()
  const { setShowSwitcherModal } = useIdeRedesignSwitcherContext()
  const openEditorRedesignSwitcherModal = useCallback(() => {
    setShowSwitcherModal(true)
  }, [setShowSwitcherModal])
  const { setView, view } = useLayoutContext()
  const { pdfUrl } = useCompileContext()
  const wordCountEnabled = pdfUrl || isSplitTestEnabled('word-count-client')
  const [showWordCountModal, setShowWordCountModal] = useState(false)

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
      {
        type: 'command',
        label: t('word_count_lower'),
        disabled: !wordCountEnabled,
        handler: () => {
          setShowWordCountModal(true)
        },
        id: 'word_count',
      },
    ],
    [t, setView, view, wordCountEnabled]
  )
  const fileMenuStructure: MenuStructure = useMemo(
    () => [
      {
        id: 'file-file-tree',
        children: ['new_file', 'new_folder', 'upload_file'],
      },
      { id: 'file-tools', children: ['show_version_history', 'word_count'] },
      {
        id: 'file-download',
        children: ['download-as-source-zip', 'download-pdf'],
      },
      {
        id: 'settings',
        children: ['open-settings'],
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

  const { mathPreview, setMathPreview, breadcrumbs, setBreadcrumbs } =
    useProjectSettingsContext()

  const toggleMathPreview = useCallback(() => {
    setMathPreview(!mathPreview)
  }, [setMathPreview, mathPreview])

  const toggleBreadcrumbs = useCallback(() => {
    setBreadcrumbs(!breadcrumbs)
  }, [setBreadcrumbs, breadcrumbs])

  const { setActiveModal } = useRailContext()
  const openKeyboardShortcutsModal = useCallback(() => {
    setActiveModal('keyboard-shortcuts')
  }, [setActiveModal])
  const openContactUsModal = useCallback(() => {
    setActiveModal('contact-us')
  }, [setActiveModal])

  const surveyURL = useSurveyUrl()

  return (
    <>
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
          <DropdownDivider />
          <DropdownHeader>Editor settings</DropdownHeader>
          <MenuBarOption
            eventKey="show_breadcrumbs"
            title={t('show_breadcrumbs')}
            leadingIcon={
              breadcrumbs ? 'check' : <DropdownItem.EmptyLeadingIcon />
            }
            onClick={toggleBreadcrumbs}
          />
          <MenuBarOption
            eventKey="show_equation_preview"
            title={t('show_equation_preview')}
            leadingIcon={
              mathPreview ? 'check' : <DropdownItem.EmptyLeadingIcon />
            }
            onClick={toggleMathPreview}
          />
          <DropdownDivider />
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
            eventKey="keyboard_shortcuts"
            title={t('keyboard_shortcuts')}
            onClick={openKeyboardShortcutsModal}
          />
          <MenuBarOption
            title={t('documentation')}
            eventKey="documentation"
            href="/learn"
            target="_blank"
            rel="noopener noreferrer"
          />
          <DropdownDivider />
          <MenuBarOption
            eventKey="contact_us"
            title={t('contact_us')}
            onClick={openContactUsModal}
          />
          <MenuBarOption
            eventKey="give_feedback"
            title={t('give_feedback')}
            href={surveyURL}
            target="_blank"
            rel="noopener noreferrer"
          />
          <DropdownDivider />
          <SwitchToOldEditorMenuBarOption />
          <MenuBarOption
            eventKey="whats_new"
            title="What's new?"
            onClick={openEditorRedesignSwitcherModal}
          />
        </MenuBarDropdown>
      </MenuBar>
      <WordCountModal
        show={showWordCountModal}
        handleHide={() => setShowWordCountModal(false)}
      />
    </>
  )
}

const SwitchToOldEditorMenuBarOption = () => {
  const { loading, error, setEditorRedesignStatus } =
    useSwitchEnableNewEditorState()
  const { sendEvent } = useEditorAnalytics()

  const disable: MouseEventHandler = useCallback(
    event => {
      // Don't close the dropdown
      event.stopPropagation()
      sendEvent('editor-redesign-toggle', {
        action: 'disable',
        location: 'menu-bar',
      })
      setEditorRedesignStatus(false)
    },
    [setEditorRedesignStatus, sendEvent]
  )
  let icon = null
  if (loading) {
    icon = <OLSpinner size="sm" />
  } else if (error) {
    icon = <MaterialIcon type="error" title={error} className="text-danger" />
  }
  return (
    <MenuBarOption
      eventKey="switch_to_old_editor"
      title="Switch to old editor"
      onClick={disable}
      disabled={loading}
      trailingIcon={icon}
    />
  )
}
