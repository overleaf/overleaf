import { useCommandProvider } from '@/features/ide-react/hooks/use-command-provider'
import OLDropdownMenuItem from '@/shared/components/ol/ol-dropdown-menu-item'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { isSmallDevice, sendMB } from '@/infrastructure/event-tracking'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useProjectContext } from '@/shared/context/project-context'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'

export const DownloadProjectZip = () => {
  const { t } = useTranslation()
  const { projectId } = useProjectContext()
  const sendDownloadEvent = useCallback(() => {
    sendMB('download-zip-button-click', {
      projectId,
      location: 'project-name-dropdown',
      isSmallDevice,
    })
  }, [projectId])

  useCommandProvider(
    () => [
      {
        id: 'download-as-source-zip',
        href: `/project/${projectId}/download/zip`,
        label: t('download_as_source_zip'),
      },
    ],
    [t, projectId]
  )

  return (
    <OLDropdownMenuItem
      href={`/project/${projectId}/download/zip`}
      target="_blank"
      rel="noreferrer"
      onClick={sendDownloadEvent}
    >
      {t('download_as_source_zip')}
    </OLDropdownMenuItem>
  )
}

export const DownloadProjectPDF = () => {
  const { t } = useTranslation()
  const { pdfDownloadUrl, pdfUrl } = useCompileContext()
  const { projectId } = useProjectContext()
  const { sendEvent } = useEditorAnalytics()
  const sendDownloadEvent = useCallback(() => {
    sendEvent('download-pdf-button-click', {
      projectId,
      location: 'project-name-dropdown',
      isSmallDevice,
    })
  }, [projectId, sendEvent])

  useCommandProvider(
    () => [
      {
        id: 'download-pdf',
        disabled: !pdfUrl,
        href: pdfDownloadUrl || pdfUrl,
        handler: ({ location }) => {
          sendEvent('download-pdf-button-click', {
            projectId,
            location,
            isSmallDevice,
          })
        },
        label: t('download_as_pdf'),
      },
    ],
    [t, pdfUrl, projectId, pdfDownloadUrl, sendEvent]
  )

  const button = (
    <OLDropdownMenuItem
      href={pdfDownloadUrl || pdfUrl}
      target="_blank"
      rel="noreferrer"
      onClick={sendDownloadEvent}
      disabled={!pdfUrl}
    >
      {t('download_as_pdf')}
    </OLDropdownMenuItem>
  )

  if (!pdfUrl) {
    return (
      <OLTooltip
        id="tooltip-download-pdf-unavailable"
        description={t('please_compile_pdf_before_download')}
        overlayProps={{ placement: 'right', delay: 0 }}
      >
        <span>{button}</span>
      </OLTooltip>
    )
  } else {
    return button
  }
}
