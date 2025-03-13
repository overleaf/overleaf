import OLDropdownMenuItem from '@/features/ui/components/ol/ol-dropdown-menu-item'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import { isSmallDevice, sendMB } from '@/infrastructure/event-tracking'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useProjectContext } from '@/shared/context/project-context'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

export const DownloadProjectZip = () => {
  const { t } = useTranslation()
  const { _id: projectId } = useProjectContext()
  const sendDownloadEvent = useCallback(() => {
    sendMB('download-zip-button-click', {
      projectId,
      location: 'project-name-dropdown',
      isSmallDevice,
    })
  }, [projectId])

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
  const { _id: projectId } = useProjectContext()
  const sendDownloadEvent = useCallback(() => {
    sendMB('download-pdf-button-click', {
      projectId,
      location: 'project-name-dropdown',
      isSmallDevice,
    })
  }, [projectId])

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
