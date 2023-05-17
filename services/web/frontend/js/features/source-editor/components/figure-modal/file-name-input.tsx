import {
  DetailedHTMLProps,
  InputHTMLAttributes,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { File, FileOrDirectory } from '../../utils/file'
import useScopeValue from '../../../../shared/hooks/use-scope-value'
import { Alert } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

type FileNameInputProps = Omit<
  DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>,
  'onFocus'
> & { targetFolder: File | null }

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
  targetFolder,
  ...props
}: FileNameInputProps) => {
  const { t } = useTranslation()
  const [overlap, setOverlap] = useState<boolean>(false)
  const [rootFolder] = useScopeValue<FileOrDirectory>('rootFolder')
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
      <input {...props} type="text" onFocus={onFocus} />
      {overlap && (
        <Alert bsStyle="warning" className="mt-1 mb-0">
          {t('a_file_with_that_name_already_exists_and_will_be_overriden')}
        </Alert>
      )}
    </>
  )
}
