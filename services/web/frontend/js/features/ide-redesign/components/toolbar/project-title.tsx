import {
  Dropdown,
  DropdownDivider,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import MaterialIcon from '@/shared/components/material-icon'
import { useProjectContext } from '@/shared/context/project-context'
import { useTranslation } from 'react-i18next'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import { useEditorContext } from '@/shared/context/editor-context'
import { DownloadProjectPDF, DownloadProjectZip } from './download-project'
import { useCallback, useState } from 'react'
import OLDropdownMenuItem from '@/features/ui/components/ol/ol-dropdown-menu-item'
import EditableLabel from './editable-label'

const [publishModalModules] = importOverleafModules('publishModal')
const SubmitProjectButton = publishModalModules?.import.NewPublishToolbarButton

export const ToolbarProjectTitle = () => {
  const { t } = useTranslation()
  const { permissionsLevel, renameProject } = useEditorContext()
  const { name } = useProjectContext()
  const shouldDisplaySubmitButton =
    (permissionsLevel === 'owner' || permissionsLevel === 'readAndWrite') &&
    SubmitProjectButton
  const hasRenamePermissions = permissionsLevel === 'owner'
  const [isRenaming, setIsRenaming] = useState(false)
  const onRename = useCallback(
    name => {
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
    <Dropdown align="start">
      <DropdownToggle
        id="project-title-options"
        className="ide-redesign-toolbar-dropdown-toggle-subdued fw-bold  ide-redesign-toolbar-button-subdued"
      >
        {name}
        <MaterialIcon
          type="keyboard_arrow_down"
          accessibilityLabel={t('project_title_options')}
        />
      </DropdownToggle>
      <DropdownMenu renderOnMount>
        {shouldDisplaySubmitButton && (
          <>
            <SubmitProjectButton />
            <DropdownDivider />
          </>
        )}
        <DownloadProjectPDF />
        <DownloadProjectZip />
        <DropdownDivider />
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
