import { Trans, useTranslation } from 'react-i18next'
import ErrorState from './error-state'
import getMeta from '@/utils/meta'

export default function RenderingErrorState() {
  const { t } = useTranslation()

  return (
    <ErrorState
      title={t('pdf_rendering_error')}
      description={
        <>
          {t('something_went_wrong_rendering_pdf')}
          &nbsp;
          <Trans
            i18nKey="try_recompile_project_or_troubleshoot"
            components={[
              // eslint-disable-next-line jsx-a11y/anchor-has-content
              <a
                href="/learn/how-to/Resolving_access%2C_loading%2C_and_display_problems"
                target="_blank"
                key="troubleshooting-link"
              />,
            ]}
          />
          {getMeta('ol-compilesUserContentDomain') && (
            <>
              <br />
              <br />
              <Trans
                i18nKey="new_compile_domain_notice"
                values={{
                  compilesUserContentDomain: new URL(
                    getMeta('ol-compilesUserContentDomain')
                  ).hostname,
                }}
                shouldUnescape
                tOptions={{ interpolation: { escapeValue: true } }}
                components={[
                  <code key="domain" />,
                  /* eslint-disable-next-line jsx-a11y/anchor-has-content */
                  <a
                    href="/learn/how-to/Resolving_access%2C_loading%2C_and_display_problems"
                    target="_blank"
                    key="troubleshooting-link"
                  />,
                ]}
              />
            </>
          )}
        </>
      }
    />
  )
}
