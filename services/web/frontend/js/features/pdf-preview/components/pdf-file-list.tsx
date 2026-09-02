import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import {
  OLDropdownDivider,
  OLDropdownHeader,
  OLDropdownItem,
} from '@/shared/components/ol/ol-dropdown-menu'
import { PdfFileData, PdfFileDataList } from '../util/types'

function PdfFileList({ fileList }: { fileList: PdfFileDataList }) {
  const { t } = useTranslation()

  if (!fileList) {
    return null
  }

  function basename(file: PdfFileData) {
    return file.path.split('/').pop()
  }

  return (
    <>
      <OLDropdownHeader>{t('other_output_files')}</OLDropdownHeader>

      {fileList.top.map(file => (
        <li key={file.path} role="menuitem">
          <OLDropdownItem
            role="link"
            download={basename(file)}
            href={file.downloadURL || file.url}
          >
            {file.path}
          </OLDropdownItem>
        </li>
      ))}

      {fileList.other.length > 0 && fileList.top.length > 0 && (
        <OLDropdownDivider />
      )}

      {fileList.other.map(file => (
        <li key={file.path} role="menuitem">
          <OLDropdownItem
            role="link"
            download={basename(file)}
            href={file.downloadURL || file.url}
          >
            {file.path}
          </OLDropdownItem>
        </li>
      ))}

      {fileList.archive?.fileCount !== undefined &&
        fileList.archive?.fileCount > 0 && (
          <li role="menuitem">
            <OLDropdownItem
              role="link"
              download={basename(fileList.archive)}
              href={fileList.archive.url}
            >
              {t('download_all')} ({fileList.archive.fileCount})
            </OLDropdownItem>
          </li>
        )}
    </>
  )
}

export default memo(PdfFileList)
