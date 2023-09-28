import { useState, useCallback, type ElementType } from 'react'
import PropTypes from 'prop-types'
import { Trans, useTranslation } from 'react-i18next'

import Icon from '../../../shared/components/icon'
import { formatTime, relativeDate } from '../../utils/format-date'
import { postJSON } from '../../../infrastructure/fetch-json'
import { useEditorContext } from '../../../shared/context/editor-context'
import { useProjectContext } from '../../../shared/context/project-context'

import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import useAbortController from '../../../shared/hooks/use-abort-controller'
import { LinkedFileIcon } from './file-view-icons'
import { BinaryFile, hasProvider, LinkedFile } from '../types/binary-file'

const tprLinkedFileInfo = importOverleafModules('tprLinkedFileInfo') as {
  import: { LinkedFileInfo: ElementType }
  path: string
}[]

const tprLinkedFileRefreshError = importOverleafModules(
  'tprLinkedFileRefreshError'
) as {
  import: { LinkedFileRefreshError: ElementType }
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
  const { _id: projectId } = useProjectContext({
    _id: PropTypes.string.isRequired,
  })
  const { permissionsLevel } = useEditorContext({
    permissionsLevel: PropTypes.string,
  })
  const { t } = useTranslation()

  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(null)

  const { signal } = useAbortController()

  let fileInfo
  if (file.linkedFileData) {
    if (hasProvider(file, 'url')) {
      fileInfo = (
        <div>
          <UrlProvider file={file} />
        </div>
      )
    } else if (hasProvider(file, 'project_file')) {
      fileInfo = (
        <div>
          <ProjectFilePathProvider file={file} />
        </div>
      )
    } else if (hasProvider(file, 'project_output_file')) {
      fileInfo = (
        <div>
          <ProjectOutputFileProvider file={file} />
        </div>
      )
    }
  }

  const refreshFile = useCallback(() => {
    setRefreshing(true)
    // Replacement of the file handled by the file tree
    window.expectingLinkedFileRefreshedSocketFor = file.name
    const body = {
      shouldReindexReferences:
        file.linkedFileData?.provider === 'mendeley' ||
        file.linkedFileData?.provider === 'zotero' ||
        /\.bib$/.test(file.name),
    }
    postJSON(`/project/${projectId}/linked_file/${file.id}/refresh`, {
      signal,
      body,
    })
      .then(() => {
        setRefreshing(false)
      })
      .catch(err => {
        setRefreshing(false)
        setRefreshError(err.data?.message || err.message)
      })
  }, [file, projectId, signal])

  return (
    <div>
      {file.linkedFileData && fileInfo}
      {file.linkedFileData &&
        tprLinkedFileInfo.map(({ import: { LinkedFileInfo }, path }) => (
          <LinkedFileInfo key={path} file={file} />
        ))}
      {file.linkedFileData && permissionsLevel !== 'readOnly' && (
        <button
          className="btn btn-primary"
          onClick={refreshFile}
          disabled={refreshing}
        >
          <Icon type="refresh" spin={refreshing} fw />
          <span>{refreshing ? t('refreshing') + '...' : t('refresh')}</span>
        </button>
      )}
      &nbsp;
      <a
        download
        href={`/project/${projectId}/file/${file.id}`}
        className="btn btn-secondary-info btn-secondary"
      >
        <Icon type="download" fw />
        &nbsp;
        <span>{t('download')}</span>
      </a>
      {refreshError && (
        <div className="row">
          <br />
          <div className="alert alert-danger col-md-6 col-md-offset-3">
            {t('access_denied')}: {refreshError}
            {tprLinkedFileRefreshError.map(
              ({ import: { LinkedFileRefreshError }, path }) => (
                <LinkedFileRefreshError key={path} file={file} />
              )
            )}
          </div>
        </div>
      )}
    </div>
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
      <LinkedFileIcon />
      &nbsp;
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
      />
    </p>
  )
}
