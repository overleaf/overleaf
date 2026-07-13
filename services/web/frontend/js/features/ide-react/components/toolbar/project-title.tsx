import {
  OLDropdown,
  OLDropdownDivider,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import MaterialIcon from '@/shared/components/material-icon'
import { useProjectContext } from '@/shared/context/project-context'
import { useTranslation } from 'react-i18next'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import { useEditorContext } from '@/shared/context/editor-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { DownloadProjectPDF, DownloadProjectZip } from './download-project'
import { useCallback, useState } from 'react'
import DropdownMenuItem from '@/shared/components/dropdown/dropdown-menu-item'
import EditableLabel from './editable-label'
import { DuplicateProject } from './duplicate-project'
import { ExportProjectWithConversionButton } from './export-project-with-conversion-button'

const [publishModalModules] = importOverleafModules(
  'publishModalDropdownButton'
)
const SubmitProjectButton = publishModalModules?.import.default

export const ToolbarProjectTitle = () => {
  const { cobranding } = useEditorContext()
  const { t } = useTranslation()
  const { renameProject } = useEditorContext()
  const { permissionsLevel } = useIdeReactContext()
  const { name } = useProjectContext()
  const shouldDisplaySubmitButton =
    (permissionsLevel === 'owner' || permissionsLevel === 'readAndWrite') &&
    SubmitProjectButton
  const hasRenamePermissions = permissionsLevel === 'owner'
  const [isRenaming, setIsRenaming] = useState(false)
  const onRename = useCallback(
    (name: string) => {
      if (name) {
        renameProject(name)
      }
      setIsRenaming(false)
    },
    [renameProject]
  )
  const onCancel = useCallback(() => {
    setIsRenaming(false)
  }, [])

  if (isRenaming) {
    return (
      <EditableLabel
        onChange={onRename}
        onCancel={onCancel}
        initialText={name}
        maxLength={150}
        className="ide-redesign-toolbar-editable-project-name"
      />
    )
  }

  return (
    <OLDropdown align="end" className="ide-redesign-toolbar-project-dropdown">
      <OLDropdownToggle
        id="project-title-options"
        aria-label={t('project_title_options')}
        className="ide-redesign-toolbar-project-dropdown-toggle ide-redesign-toolbar-dropdown-toggle-subdued fw-bold ide-redesign-toolbar-button-subdued"
      >
        <span className="ide-redesign-toolbar-project-name" translate="no">
          {name}
        </span>
        <MaterialIcon type="keyboard_arrow_down" />
      </OLDropdownToggle>
      <OLDropdownMenu renderOnMount>
        {shouldDisplaySubmitButton && !cobranding && (
          <>
            <SubmitProjectButton />
            <OLDropdownDivider />
          </>
        )}
        <DownloadProjectPDF />
        <DownloadProjectZip />
        <ExportProjectWithConversionButton
          featureFlag="export-docx"
          conversionType="docx"
          label={t('export_as_docx')}
          menuBarId="export-as-docx"
        />
        <ExportProjectWithConversionButton
          featureFlag="export-markdown"
          conversionType="markdown"
          label={t('export_as_markdown')}
          menuBarId="export-as-markdown"
        />
        <ExportProjectWithConversionButton
          featureFlag="export-html"
          conversionType="html"
          label={t('export_as_html')}
          menuBarId="export-as-html"
        />
        <OLDropdownDivider />
        <DuplicateProject />
        <DropdownMenuItem
          onClick={() => {
            setIsRenaming(true)
          }}
          disabled={!hasRenamePermissions}
        >
          {t('rename')}
        </DropdownMenuItem>
      </OLDropdownMenu>
    </OLDropdown>
  )
}
