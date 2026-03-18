import { useTranslation, Trans } from 'react-i18next'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import OLButton from '@/shared/components/ol/ol-button'
import overleafLogo from '@/shared/svgs/overleaf-logo.svg'
import getMeta from '@/utils/meta'

type InviteNotValidProps = {
  email?: string
}

function InviteNotValid({ email }: InviteNotValidProps) {
  const { t } = useTranslation()
  const { appName } = getMeta('ol-ExposedSettings')

  return (
    <div className="container">
      <OLRow>
        <OLCol lg={{ span: 6, offset: 3 }}>
          <div className="project-join-container">
            <img src={overleafLogo} alt={appName} />
            <h1 className="h4 mb-2">
              {t('sorry_this_project_is_not_available')}
            </h1>
            <div className="mb-4">
              {t('the_link_may_be_broken_or_you_may_not_have_access_rights')}
            </div>
            {email && (
              <>
                <OLButton
                  variant="primary"
                  size="lg"
                  href="/project"
                  className="mb-4"
                >
                  {t('back_to_my_projects')}
                </OLButton>
                <div>
                  <small>
                    <Trans
                      i18nKey="you_are_currently_logged_in_as_x_you_might_need_to_log_in_with_different_email"
                      components={[<b />]} // eslint-disable-line react/jsx-key
                      values={{ email }}
                      shouldUnescape
                      tOptions={{ interpolation: { escapeValue: true } }}
                    />
                  </small>
                </div>
              </>
            )}
          </div>
        </OLCol>
      </OLRow>
    </div>
  )
}

export default InviteNotValid
