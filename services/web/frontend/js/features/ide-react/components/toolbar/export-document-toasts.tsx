import { GlobalToastGeneratorEntry } from '@/features/ide-react/components/global-toasts'
import { Trans, useTranslation } from 'react-i18next'

const PreparingExportToast = () => {
  const { t } = useTranslation()
  return <span>{t('preparing_for_export')}</span>
}

const ExportDocumentErrorToast = ({ data }: { data?: any }) => {
  const { t } = useTranslation()
  const errorMessage =
    typeof data?.errorMessage === 'string' ? data.errorMessage : null

  return (
    <>
      <p>
        <b>{t('we_couldnt_export_this_document')}</b>
      </p>
      <Trans
        i18nKey="the_document_contains_formatting_we_werent_able_to_convert"
        components={[
          // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
          <a
            href="https://docs.overleaf.com/managing-projects-and-files/importing-and-exporting-files#common-issues-and-how-to-address-them"
            target="_BLANK"
            rel="noopener noreferrer"
          />,
        ]}
      />
      {errorMessage && (
        <details>
          <summary>{t('conversion_error_details')}</summary>
          <pre
            style={{ maxWidth: '800px', maxHeight: '300px', overflow: 'auto' }}
          >
            <code>{errorMessage}</code>
          </pre>
        </details>
      )}
    </>
  )
}

const ExportDocumentSuccessToast = ({ data }: { data?: any }) => {
  const type = data?.type
  if (type === 'docx') {
    return (
      <Trans
        i18nKey="docx_export_feedback_message"
        components={[
          // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
          <a
            href="https://forms.gle/Fg4BUXV2yv61hStX8"
            target="_BLANK"
            rel="noopener noreferrer"
          />,
        ]}
      />
    )
  } else if (type === 'markdown') {
    return (
      <Trans
        i18nKey="markdown_export_feedback_message"
        components={[
          // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
          <a
            href="https://forms.gle/wc43zEukeqpec9mAA"
            target="_BLANK"
            rel="noopener noreferrer"
          />,
        ]}
      />
    )
  } else if (type === 'html') {
    return (
      <Trans
        i18nKey="html_export_feedback_message"
        components={[
          // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
          <a
            href="https://forms.gle/nBUVGqPYwLcWHSmt5"
            target="_BLANK"
            rel="noopener noreferrer"
          />,
        ]}
      />
    )
  } else {
    return (
      <Trans
        i18nKey="generic_export_feedback_message"
        components={[
          // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
          <a href="/contact" target="_BLANK" rel="noopener noreferrer" />,
        ]}
      />
    )
  }
}

const generators: GlobalToastGeneratorEntry[] = [
  {
    key: 'export-document:error',
    generator: (data: any) => ({
      content: <ExportDocumentErrorToast data={data} />,
      type: 'error',
      // Only auto-hide if we have no extra details
      autoHide: !data?.errorMessage,
      delay: 5000,
      isDismissible: true,
    }),
  },
  {
    key: 'export-document:preparing',
    generator: () => ({
      content: <PreparingExportToast />,
      type: 'info',
      autoHide: false,
      isDismissible: true,
    }),
  },
  {
    key: 'export-document:success',
    generator: (data: any) => ({
      content: <ExportDocumentSuccessToast data={data} />,
      type: 'success',
      autoHide: true,
      delay: 45000,
      isDismissible: true,
    }),
  },
]

export default generators

// We only ever care about the latest error toast, so use a static handle.
const EXPORT_DOCUMENT_ERROR_HANDLE = 'export-document-error'

export const showExportDocumentError = (errorMessage?: string) => {
  window.dispatchEvent(
    new CustomEvent('ide:show-toast', {
      detail: {
        key: 'export-document:error',
        handle: EXPORT_DOCUMENT_ERROR_HANDLE,
        errorMessage,
      },
    })
  )
}

export const hideExportDocumentError = () => {
  window.dispatchEvent(
    new CustomEvent('ide:dismiss-toast', {
      detail: { handle: EXPORT_DOCUMENT_ERROR_HANDLE },
    })
  )
}

export const showPreparingExportToast = () => {
  const handle = `export-document-preparing-${Date.now()}`
  window.dispatchEvent(
    new CustomEvent('ide:show-toast', {
      detail: { key: 'export-document:preparing', handle },
    })
  )
  return handle
}

export const hidePreparingExportToast = (handle: string) => {
  window.dispatchEvent(
    new CustomEvent('ide:dismiss-toast', {
      detail: { key: 'export-document:preparing', handle },
    })
  )
}

export const showExportDocumentSuccess = (
  type: 'docx' | 'markdown' | 'html'
) => {
  window.dispatchEvent(
    new CustomEvent('ide:show-toast', {
      detail: { key: 'export-document:success', type },
    })
  )
}
