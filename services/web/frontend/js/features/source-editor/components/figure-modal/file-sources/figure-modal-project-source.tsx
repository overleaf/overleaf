import { FC, useMemo } from 'react'
import useScopeValue from '../../../../../shared/hooks/use-scope-value'
import { Select } from '../../../../../shared/components/select'
import { useFigureModalContext } from '../figure-modal-context'
import { FileOrDirectory, filterFiles, isImageFile } from '../../../utils/file'
import { useTranslation } from 'react-i18next'

export const FigureModalCurrentProjectSource: FC = () => {
  const { t } = useTranslation()
  const [rootFolder] = useScopeValue<FileOrDirectory>('rootFolder')
  const files = useMemo(
    () => filterFiles(rootFolder)?.filter(isImageFile),
    [rootFolder]
  )
  const { dispatch } = useFigureModalContext()
  const noFiles = files?.length === 0
  return (
    <Select
      items={files || []}
      itemToString={file => (file ? file.name : '')}
      itemToSubtitle={item => item?.path ?? ''}
      itemToKey={item => item.id}
      defaultText={
        noFiles
          ? t('no_image_files_found')
          : t('select_image_from_project_files')
      }
      label="Image file"
      onSelectedItemChanged={item => {
        dispatch({
          getPath: item ? async () => `${item.path}${item.name}` : undefined,
        })
      }}
    />
  )
}
