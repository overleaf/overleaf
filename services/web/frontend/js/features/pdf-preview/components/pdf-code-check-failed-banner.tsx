import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'

export default function PdfCodeCheckFailedBanner() {
  const { t } = useTranslation()

  const { codeCheckFailed } = useCompileContext()

  if (!codeCheckFailed) {
    return null
  }

  return (
    <div className="pdf-code-check-failed-banner-container">
      <div className="pdf-code-check-failed-banner">
        <MaterialIcon unfilled type="picture_as_pdf" />
        {t('code_check_failed_explanation')}
      </div>
    </div>
  )
}
