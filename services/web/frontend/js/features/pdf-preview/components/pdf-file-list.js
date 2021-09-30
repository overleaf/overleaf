import { MenuItem } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import PropTypes from 'prop-types'

function PdfFileList({ fileList }) {
  const { t } = useTranslation()

  if (!fileList) {
    return null
  }

  return (
    <>
      <MenuItem header>{t('other_output_files')}</MenuItem>

      {fileList.top.map(file => (
        <MenuItem download href={file.url} key={file.path}>
          <b>{file.path}</b>
        </MenuItem>
      ))}

      {fileList.other.length > 0 && fileList.top.length > 0 && (
        <MenuItem divider />
      )}

      {fileList.other.map(file => (
        <MenuItem download href={file.url} key={file.path}>
          <b>{file.path}</b>
        </MenuItem>
      ))}
    </>
  )
}

const FilesArray = PropTypes.arrayOf(
  PropTypes.shape({
    path: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
  })
)

PdfFileList.propTypes = {
  fileList: PropTypes.shape({
    top: FilesArray,
    other: FilesArray,
  }),
}

export default memo(PdfFileList)
