import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import {
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
} from '@/shared/components/dropdown/dropdown-menu'
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
      <DropdownHeader>{t('other_output_files')}</DropdownHeader>

      {fileList.top.map(file => (
        <li key={file.path} role="menuitem">
          <DropdownItem
            role="link"
            download={basename(file)}
            href={file.downloadURL || file.url}
          >
            {file.path}
          </DropdownItem>
        </li>
      ))}

      {fileList.other.length > 0 && fileList.top.length > 0 && (
        <DropdownDivider />
      )}

      {fileList.other.map(file => (
        <li key={file.path} role="menuitem">
          <DropdownItem
            role="link"
            download={basename(file)}
            href={file.downloadURL || file.url}
          >
            {file.path}
          </DropdownItem>
        </li>
      ))}

      {fileList.archive?.fileCount !== undefined &&
        fileList.archive?.fileCount > 0 && (
          <li role="menuitem">
            <DropdownItem
              role="link"
              download={basename(fileList.archive)}
              href={fileList.archive.url}
            >
              {t('download_all')} ({fileList.archive.fileCount})
            </DropdownItem>
          </li>
        )}
    </>
  )
}

export default memo(PdfFileList)
