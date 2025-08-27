import { Trans, useTranslation } from 'react-i18next'
import ErrorState from './error-state'
import OLButton from '@/shared/components/ol/ol-button'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'

export default function RenderingErrorExpectedState() {
  const { t } = useTranslation()

  const { startCompile } = useCompileContext()

  return (
    <ErrorState
      title={t('pdf_rendering_error')}
      description={
        <Trans
          i18nKey="something_went_wrong_rendering_pdf_expected_new"
          components={[
            // eslint-disable-next-line jsx-a11y/anchor-has-content
            <a
              href="/learn/how-to/Resolving_access%2C_loading%2C_and_display_problems"
              target="_blank"
              key="troubleshooting-link"
            />,
          ]}
        />
      }
      actions={[
        // eslint-disable-next-line react/jsx-key
        <OLButton variant="primary" size="sm" onClick={() => startCompile()}>
          {t('recompile')}
        </OLButton>,
      ]}
    />
  )
}
