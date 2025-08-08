import { useCallback, useEffect, useState } from 'react'
import { File, FileOrDirectory } from '../../utils/file'
import { useTranslation } from 'react-i18next'
import { useCurrentProjectFolders } from '@/features/source-editor/hooks/use-current-project-folders'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLNotification from '@/shared/components/ol/ol-notification'

type FileNameInputProps = Omit<
  React.ComponentProps<typeof OLFormControl>,
  'onFocus'
> & { targetFolder: File | null; label: string }

function findFile(
  folder: { id: string; name: string },
  project: FileOrDirectory
): FileOrDirectory | null {
  if (project.id === folder.id) {
    return project
  }
  if (project.type !== 'folder') {
    return null
  }
  for (const child of project.children ?? []) {
    const search = findFile(folder, child)
    if (search) {
      return search
    }
  }
  return null
}

function hasOverlap(
  name: string,
  folder: { id: string; name: string },
  project: FileOrDirectory
): boolean {
  const directory = findFile(folder, project)
  if (!directory) {
    return false
  }
  for (const child of directory.children ?? []) {
    if (child.name === name) {
      return true
    }
  }
  return false
}

export const FileNameInput = ({
  id,
  label,
  targetFolder,
  ...props
}: FileNameInputProps) => {
  const { t } = useTranslation()
  const [overlap, setOverlap] = useState<boolean>(false)
  const { rootFolder } = useCurrentProjectFolders()
  const { value } = props

  useEffect(() => {
    if (value) {
      setOverlap(
        hasOverlap(String(value), targetFolder ?? rootFolder, rootFolder)
      )
    } else {
      setOverlap(false)
    }
  }, [value, targetFolder, rootFolder])

  const onFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    if (!event.target) {
      return true
    }
    const fileName = event.target.value
    const fileExtensionIndex = fileName.lastIndexOf('.')
    if (fileExtensionIndex >= 0) {
      event.target.setSelectionRange(0, fileExtensionIndex)
    }
  }, [])
  return (
    <>
      <OLFormGroup controlId={id}>
        <OLFormLabel>{label}</OLFormLabel>
        <OLFormControl onFocus={onFocus} {...props} />
        {overlap && (
          <OLNotification
            type="warning"
            content={t(
              'a_file_with_that_name_already_exists_and_will_be_overriden'
            )}
            className="mt-1 mb-0"
          />
        )}
      </OLFormGroup>
    </>
  )
}
