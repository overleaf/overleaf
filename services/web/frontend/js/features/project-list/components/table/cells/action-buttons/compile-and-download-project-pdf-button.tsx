import { useTranslation } from 'react-i18next'
import { memo, useCallback, useState } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { useLocation } from '../../../../../../shared/hooks/use-location'
import useAbortController from '../../../../../../shared/hooks/use-abort-controller'
import { postJSON } from '../../../../../../infrastructure/fetch-json'
import AccessibleModal from '../../../../../../shared/components/accessible-modal'
import { Button, Modal } from 'react-bootstrap'
import { isSmallDevice } from '../../../../../../infrastructure/event-tracking'

type CompileAndDownloadProjectPDFButtonProps = {
  project: Project
  children: (
    text: string,
    pendingDownload: boolean,
    downloadProject: (fn: () => void) => void
  ) => React.ReactElement
}

function CompileAndDownloadProjectPDFButton({
  project,
  children,
}: CompileAndDownloadProjectPDFButtonProps) {
  const { t } = useTranslation()
  const location = useLocation()

  const { signal } = useAbortController()
  const [pendingCompile, setPendingCompile] = useState(false)

  const downloadProject = useCallback(
    onDone => {
      setPendingCompile(pendingCompile => {
        if (pendingCompile) return true
        eventTracking.sendMB('project-list-page-interaction', {
          action: 'downloadPDF',
          projectId: project.id,
          isSmallDevice,
        })

        postJSON(`/project/${project.id}/compile`, {
          body: {
            check: 'silent',
            draft: false,
            incrementalCompilesEnabled: true,
          },
          signal,
        })
          .catch(() => ({ status: 'error' }))
          .then(data => {
            setPendingCompile(false)
            if (data.status === 'success') {
              const outputFile = data.outputFiles
                .filter((file: { path: string }) => file.path === 'output.pdf')
                .pop()

              const params = new URLSearchParams({
                compileGroup: data.compileGroup,
                popupDownload: 'true',
              })
              if (data.clsiServerId) {
                params.set('clsiserverid', data.clsiServerId)
              }
              // Note: Triggering concurrent downloads does not work.
              // Note: This is affecting the download of .zip files as well.
              // When creating a dynamic `a` element with `download` attribute,
              //  another "actual" UI click is needed to trigger downloads.
              // Forwarding the click `event` to the dynamic `a` element does
              //  not work either.
              location.assign(
                `/download/project/${project.id}/build/${outputFile.build}/output/output.pdf?${params}`
              )
              onDone()
            } else {
              setShowErrorModal(true)
            }
          })
        return true
      })
    },
    [project, signal, location]
  )

  const [showErrorModal, setShowErrorModal] = useState(false)

  return (
    <>
      {children(
        pendingCompile ? t('compiling') + '…' : t('download_pdf'),
        pendingCompile,
        downloadProject
      )}
      {showErrorModal && (
        <CompileErrorModal
          project={project}
          handleClose={() => {
            setShowErrorModal(false)
          }}
        />
      )}
    </>
  )
}

function CompileErrorModal({
  project,
  handleClose,
}: { project: Project } & { handleClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <AccessibleModal show onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>
            {project.name}: {t('pdf_unavailable_for_download')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>{t('generic_linked_file_compile_error')}</Modal.Body>
        <Modal.Footer>
          <a href={`/project/${project.id}`}>
            <Button bsStyle="primary">{t('open_project')}</Button>
          </a>
        </Modal.Footer>
      </AccessibleModal>
    </>
  )
}

const CompileAndDownloadProjectPDFButtonTooltip = memo(
  function CompileAndDownloadProjectPDFButtonTooltip({
    project,
  }: Pick<CompileAndDownloadProjectPDFButtonProps, 'project'>) {
    return (
      <CompileAndDownloadProjectPDFButton project={project}>
        {(text, pendingCompile, compileAndDownloadProject) => (
          <Tooltip
            key={`tooltip-compile-and-download-project-${project.id}`}
            id={`compile-and-download-project-${project.id}`}
            description={text}
            overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
          >
            <button
              className="btn btn-link action-btn"
              aria-label={text}
              onClick={() => compileAndDownloadProject(() => {})}
            >
              {pendingCompile ? (
                <Icon type="spinner" spin />
              ) : (
                <Icon type="file-pdf-o" />
              )}
            </button>
          </Tooltip>
        )}
      </CompileAndDownloadProjectPDFButton>
    )
  }
)

export default memo(CompileAndDownloadProjectPDFButton)
export { CompileAndDownloadProjectPDFButtonTooltip }
