import { GlobalToastGeneratorEntry } from '@/features/ide-react/components/global-toasts'
import { Trans } from 'react-i18next'

const ImportDocxFeedbackToast = () => {
  return (
    <div>
      <Trans
        i18nKey="docx_import_feedback_message"
        components={[
          /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
          <a
            href="https://forms.gle/B1qrdiD983YcQCJA9"
            target="_blank"
            rel="noopener noreferrer"
          />,
        ]}
      />
    </div>
  )
}

const generators: GlobalToastGeneratorEntry[] = [
  {
    key: 'import:docx-feedback',
    generator: () => ({
      content: <ImportDocxFeedbackToast />,
      type: 'info',
      autoHide: false,
      isDismissible: true,
    }),
  },
]

export default generators

export const showImportDocxFeedbackToast = () => {
  window.dispatchEvent(
    new CustomEvent('ide:show-toast', {
      detail: { key: 'import:docx-feedback' },
    })
  )
}
