import { FC, useMemo } from 'react'
import { Select } from '../../../../../shared/components/select'
import { useFigureModalContext } from '../figure-modal-context'
import { filterFiles, isImageFile } from '../../../utils/file'
import { useTranslation } from 'react-i18next'
import { useCurrentProjectFolders } from '@/features/source-editor/hooks/use-current-project-folders'
import OLFormGroup from '@/shared/components/ol/ol-form-group'

export const FigureModalCurrentProjectSource: FC = () => {
  const { t } = useTranslation()
  const { rootFolder } = useCurrentProjectFolders()
  const files = useMemo(
    () => filterFiles(rootFolder)?.filter(isImageFile),
    [rootFolder]
  )
  const { dispatch, selectedItemId } = useFigureModalContext()
  const noFiles = files?.length === 0
  return (
    <OLFormGroup>
      <Select
        items={files || []}
        itemToString={file => (file ? file.name : '')}
        itemToSubtitle={item => item?.path ?? ''}
        itemToKey={item => item.id}
        defaultItem={
          files && selectedItemId
            ? files.find(item => item.id === selectedItemId)
            : undefined
        }
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
    </OLFormGroup>
  )
}
