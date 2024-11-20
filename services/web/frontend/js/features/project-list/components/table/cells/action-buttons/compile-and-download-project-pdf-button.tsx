import { useTranslation } from 'react-i18next'
import { memo, useCallback, useState } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { useLocation } from '../../../../../../shared/hooks/use-location'
import useAbortController from '../../../../../../shared/hooks/use-abort-controller'
import { postJSON } from '../../../../../../infrastructure/fetch-json'
import { isSmallDevice } from '../../../../../../infrastructure/event-tracking'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLIconButton from '@/features/ui/components/ol/ol-icon-button'

type CompileAndDownloadProjectPDFButtonProps = {
  project: Project
  children: (
    text: string,
    pendingDownload: boolean,
    downloadProject: <T extends React.MouseEvent>(
      e?: T,
      fn?: (e?: T) => void
    ) => void
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
    <T extends React.MouseEvent>(e?: T, onDone?: (e?: T) => void) => {
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
              onDone?.(e)
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
      <OLModal show onHide={handleClose}>
        <OLModalHeader closeButton>
          <OLModalTitle>
            {project.name}: {t('pdf_unavailable_for_download')}
          </OLModalTitle>
        </OLModalHeader>
        <OLModalBody>{t('generic_linked_file_compile_error')}</OLModalBody>
        <OLModalFooter>
          <OLButton variant="primary" href={`/project/${project.id}`}>
            {t('open_project')}
          </OLButton>
        </OLModalFooter>
      </OLModal>
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
          <OLTooltip
            key={`tooltip-compile-and-download-project-${project.id}`}
            id={`compile-and-download-project-${project.id}`}
            description={text}
            overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
          >
            <span>
              <OLIconButton
                onClick={compileAndDownloadProject}
                variant="link"
                accessibilityLabel={text}
                loadingLabel={text}
                isLoading={pendingCompile}
                className="action-btn"
                icon="picture_as_pdf"
              />
            </span>
          </OLTooltip>
        )}
      </CompileAndDownloadProjectPDFButton>
    )
  }
)

export default memo(CompileAndDownloadProjectPDFButton)
export { CompileAndDownloadProjectPDFButtonTooltip }
