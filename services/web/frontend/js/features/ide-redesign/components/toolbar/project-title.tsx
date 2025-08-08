import {
  Dropdown,
  DropdownDivider,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import MaterialIcon from '@/shared/components/material-icon'
import { useProjectContext } from '@/shared/context/project-context'
import { useTranslation } from 'react-i18next'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import { useEditorContext } from '@/shared/context/editor-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { DownloadProjectPDF, DownloadProjectZip } from './download-project'
import { useCallback, useState } from 'react'
import OLDropdownMenuItem from '@/shared/components/ol/ol-dropdown-menu-item'
import EditableLabel from './editable-label'
import { DuplicateProject } from './duplicate-project'

const [publishModalModules] = importOverleafModules('publishModal')
const SubmitProjectButton = publishModalModules?.import.NewPublishDropdownButton

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
    <Dropdown align="start" className="ide-redesign-toolbar-project-dropdown">
      <DropdownToggle
        id="project-title-options"
        className="ide-redesign-toolbar-project-dropdown-toggle ide-redesign-toolbar-dropdown-toggle-subdued fw-bold ide-redesign-toolbar-button-subdued"
      >
        <span className="ide-redesign-toolbar-project-name" translate="no">
          {name}
        </span>
        <MaterialIcon
          type="keyboard_arrow_down"
          accessibilityLabel={t('project_title_options')}
        />
      </DropdownToggle>
      <DropdownMenu renderOnMount>
        {shouldDisplaySubmitButton && !cobranding && (
          <>
            <SubmitProjectButton />
            <DropdownDivider />
          </>
        )}
        <DownloadProjectPDF />
        <DownloadProjectZip />
        <DropdownDivider />
        <DuplicateProject />
        <OLDropdownMenuItem
          onClick={() => {
            setIsRenaming(true)
          }}
          disabled={!hasRenamePermissions}
        >
          {t('rename')}
        </OLDropdownMenuItem>
      </DropdownMenu>
    </Dropdown>
  )
}
