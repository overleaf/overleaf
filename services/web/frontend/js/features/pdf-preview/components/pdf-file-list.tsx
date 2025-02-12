import { MenuItem as BS3MenuItem } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import {
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
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
    <BootstrapVersionSwitcher
      bs3={
        <>
          <BS3MenuItem header>{t('other_output_files')}</BS3MenuItem>

          {fileList.top.map(file => (
            <BS3MenuItem
              download={basename(file)}
              href={file.url}
              key={file.path}
            >
              <b>{file.path}</b>
            </BS3MenuItem>
          ))}

          {fileList.other.length > 0 && fileList.top.length > 0 && (
            <BS3MenuItem divider />
          )}

          {fileList.other.map(file => (
            <BS3MenuItem
              download={basename(file)}
              href={file.url}
              key={file.path}
            >
              <b>{file.path}</b>
            </BS3MenuItem>
          ))}

          {fileList.archive?.fileCount && fileList.archive?.fileCount > 0 && (
            <BS3MenuItem
              download={basename(fileList.archive)}
              href={fileList.archive.url}
            >
              <b>
                {t('download_all')} ({fileList.archive.fileCount})
              </b>
            </BS3MenuItem>
          )}
        </>
      }
      bs5={
        <>
          <DropdownHeader>{t('other_output_files')}</DropdownHeader>

          {fileList.top.map(file => (
            <li key={file.path} role="menuitem">
              <DropdownItem
                role="link"
                download={basename(file)}
                href={file.url}
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
                href={file.url}
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
      }
    />
  )
}

export default memo(PdfFileList)
