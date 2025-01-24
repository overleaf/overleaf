import { useState, type ElementType } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import Icon from '../../../shared/components/icon'
import { formatTime, relativeDate } from '../../utils/format-date'
import { fileUrl } from '../../utils/fileUrl'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useProjectContext } from '@/shared/context/project-context'

import { Nullable } from '../../../../../types/utils'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { LinkedFileIcon } from './file-view-icons'
import { BinaryFile, hasProvider, LinkedFile } from '../types/binary-file'
import FileViewRefreshButton from './file-view-refresh-button'
import FileViewRefreshError from './file-view-refresh-error'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import OLButton from '@/features/ui/components/ol/ol-button'

const tprFileViewInfo = importOverleafModules('tprFileViewInfo') as {
  import: { TPRFileViewInfo: ElementType }
  path: string
}[]

const tprFileViewNotOriginalImporter = importOverleafModules(
  'tprFileViewNotOriginalImporter'
) as {
  import: { TPRFileViewNotOriginalImporter: ElementType }
  path: string
}[]

const MAX_URL_LENGTH = 60
const FRONT_OF_URL_LENGTH = 35
const FILLER = '...'
const TAIL_OF_URL_LENGTH = MAX_URL_LENGTH - FRONT_OF_URL_LENGTH - FILLER.length

function shortenedUrl(url: string) {
  if (!url) {
    return
  }
  if (url.length > MAX_URL_LENGTH) {
    const front = url.slice(0, FRONT_OF_URL_LENGTH)
    const tail = url.slice(url.length - TAIL_OF_URL_LENGTH)
    return front + FILLER + tail
  }
  return url
}

type FileViewHeaderProps = {
  file: BinaryFile
}

export default function FileViewHeader({ file }: FileViewHeaderProps) {
  const { _id: projectId } = useProjectContext()
  const { fileTreeReadOnly } = useFileTreeData()
  const { t } = useTranslation()

  const [refreshError, setRefreshError] = useState<Nullable<string>>(null)

  let fileInfo
  if (file.linkedFileData) {
    if (hasProvider(file, 'url')) {
      fileInfo = <UrlProvider file={file} />
    } else if (hasProvider(file, 'project_file')) {
      fileInfo = <ProjectFilePathProvider file={file} />
    } else if (hasProvider(file, 'project_output_file')) {
      fileInfo = <ProjectOutputFileProvider file={file} />
    }
  }

  return (
    <>
      {file.linkedFileData && fileInfo}
      {file.linkedFileData &&
        tprFileViewInfo.map(({ import: { TPRFileViewInfo }, path }) => (
          <TPRFileViewInfo key={path} file={file} />
        ))}
      <div className="file-view-buttons">
        {file.linkedFileData && !fileTreeReadOnly && (
          <FileViewRefreshButton
            file={file}
            setRefreshError={setRefreshError}
          />
        )}
        <OLButton
          variant="secondary"
          download={file.name}
          href={fileUrl(projectId, file.id, file.hash)}
        >
          <BootstrapVersionSwitcher
            bs3={<Icon type="download" fw />}
            bs5={<MaterialIcon type="download" className="align-middle" />}
          />{' '}
          <span>{t('download')}</span>
        </OLButton>
      </div>
      {file.linkedFileData &&
        tprFileViewNotOriginalImporter.map(
          ({ import: { TPRFileViewNotOriginalImporter }, path }) => (
            <TPRFileViewNotOriginalImporter key={path} file={file} />
          )
        )[0]}
      {refreshError && (
        <FileViewRefreshError file={file} refreshError={refreshError} />
      )}

      {/* Workaround for Safari issue: https://github.com/overleaf/internal/issues/21363
       * The editor behind a file view receives key events and updates the file even if Codemirror view is not focused.
       * Changing the focus to a hidden textarea prevents this
       */}
      <textarea
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        aria-label="Invisible element to manage focus and prevent unintended behavior"
        tabIndex={-1}
        style={{ position: 'absolute', left: '-9999px' }}
      />
    </>
  )
}

type UrlProviderProps = {
  file: LinkedFile<'url'>
}

function UrlProvider({ file }: UrlProviderProps) {
  return (
    <p>
      <LinkedFileIcon />
      &nbsp;
      <Trans
        i18nKey="imported_from_external_provider_at_date"
        components={
          /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
          [<a href={file.linkedFileData.url} />]
        }
        values={{
          shortenedUrl: shortenedUrl(file.linkedFileData.url),
          formattedDate: formatTime(file.created),
          relativeDate: relativeDate(file.created),
        }}
        shouldUnescape
        tOptions={{ interpolation: { escapeValue: true } }}
      />
    </p>
  )
}

type ProjectFilePathProviderProps = {
  file: LinkedFile<'project_file'>
}

function ProjectFilePathProvider({ file }: ProjectFilePathProviderProps) {
  /* eslint-disable jsx-a11y/anchor-has-content, react/jsx-key */
  return (
    <p>
      <LinkedFileIcon />{' '}
      <Trans
        i18nKey="imported_from_another_project_at_date"
        components={
          file.linkedFileData.v1_source_doc_id
            ? [<span />]
            : [
                <a
                  href={`/project/${file.linkedFileData.source_project_id}`}
                  target="_blank"
                  rel="noopener"
                />,
              ]
        }
        values={{
          sourceEntityPath: file.linkedFileData.source_entity_path.slice(1),
          formattedDate: formatTime(file.created),
          relativeDate: relativeDate(file.created),
        }}
        shouldUnescape
        tOptions={{ interpolation: { escapeValue: true } }}
      />
    </p>
    /* esline-enable jsx-a11y/anchor-has-content, react/jsx-key */
  )
}

type ProjectOutputFileProviderProps = {
  file: LinkedFile<'project_output_file'>
}

function ProjectOutputFileProvider({ file }: ProjectOutputFileProviderProps) {
  return (
    <p>
      <LinkedFileIcon />
      &nbsp;
      <Trans
        i18nKey="imported_from_the_output_of_another_project_at_date"
        components={
          file.linkedFileData.v1_source_doc_id
            ? [<span />]
            : [
                <a
                  href={`/project/${file.linkedFileData.source_project_id}`}
                  target="_blank"
                  rel="noopener"
                />,
              ]
        }
        values={{
          sourceOutputFilePath: file.linkedFileData.source_output_file_path,
          formattedDate: formatTime(file.created),
          relativeDate: relativeDate(file.created),
        }}
        shouldUnescape
        tOptions={{ interpolation: { escapeValue: true } }}
      />
    </p>
  )
}
