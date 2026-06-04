import { useMemo, useState } from 'react'
import { Dashboard } from '@uppy/react'
import { Trans, useTranslation } from 'react-i18next'
import { useProjectUploader } from '../../hooks/use-project-uploader'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import '@uppy/core/dist/style.css'
import '@uppy/dashboard/dist/style.css'
import OLNotification from '@/shared/components/ol/ol-notification'

function ImportDocumentModal({
  type,
  onHide,
  openProject,
}: {
  type: 'docx' | 'markdown'
  onHide: () => void
  openProject: (id: string, convertedFrom?: string) => void
}) {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const IMPORT_CONFIGS = useMemo(
    () => ({
      docx: {
        allowedFileTypes: ['.docx'],
        title: t('choose_word_document'),
        browseLabel: 'Select .docx file',
        dragLabel: '%{browseFiles} or \n\n Drag .docx file',
      },
      markdown: {
        allowedFileTypes: ['.md'],
        title: t('choose_markdown_file'),
        browseLabel: 'Select .md file',
        dragLabel: '%{browseFiles} or \n\n Drag .md file',
      },
    }),
    [t]
  )
  const config = IMPORT_CONFIGS[type]

  const uppy = useProjectUploader({
    endpoint: `/project/new/import-document?type=${type}`,
    allowedFileTypes: config.allowedFileTypes,
    onSuccess: (projectId: string) => openProject(projectId, type),
    onError: response => {
      const message = response?.body?.error
      if (message) {
        setError(message)
      }
    },
    onFileAdded: () => {
      setError(null)
    },
    onFileRemoved: () => {
      setError(null)
    },
  })

  return (
    <OLModal
      show
      animation
      onHide={onHide}
      id="upload-project-modal"
      backdrop="static"
    >
      <OLModalHeader>
        <OLModalTitle as="h3">{config.title}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        {error && <ErrorNotification message={error} />}
        <p>{t('import_document_description')}</p>
        <Dashboard
          uppy={uppy}
          proudlyDisplayPoweredByUppy={false}
          showLinkToFileUploadResult={false}
          hideUploadButton
          showSelectedFiles={false}
          height={300}
          locale={{
            strings: {
              browseFiles: config.browseLabel,
              dropPasteFiles: config.dragLabel,
            },
          }}
          className="project-list-upload-project-modal-uppy-dashboard"
        />
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={onHide}>
          {t('cancel')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

const ErrorNotification = ({ message }: { message: string }) => {
  const { t } = useTranslation()
  return (
    <OLNotification
      type="error"
      className="import-error-notification"
      content={
        <div>
          <Trans
            i18nKey="your_document_couldnt_be_imported_check_our_guidance_or_expand_conversion_error_details"
            components={[
              // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
              <a
                href="https://docs.overleaf.com/managing-projects-and-files/importing-and-exporting-files#common-issues-and-how-to-address-them"
                target="_BLANK"
                rel="noopener noreferrer"
              />,
            ]}
          />
          {message && (
            <details style={{ maxHeight: '200px', overflow: 'auto' }}>
              <summary>{t('conversion_error_details')}</summary>
              <code style={{ wordBreak: 'break-all' }}>{message}</code>
            </details>
          )}
        </div>
      }
    />
  )
}

export default ImportDocumentModal
