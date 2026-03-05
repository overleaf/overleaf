import { useTranslation } from 'react-i18next'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import OLButton from '@/shared/components/ol/ol-button'
import overleafLogo from '@/shared/svgs/overleaf-logo.svg'
import getMeta from '@/utils/meta'

type InviteProps = {
  projectName: string
  email: string
  submitHandler: () => void
  isLoading?: boolean
}

function Invite({ projectName, email, submitHandler, isLoading }: InviteProps) {
  const { t } = useTranslation()
  const { appName } = getMeta('ol-ExposedSettings')

  return (
    <div className="container">
      <OLRow>
        <OLCol lg={{ span: 6, offset: 3 }}>
          <div className="project-join-container">
            <img src={overleafLogo} alt={appName} />
            <h1 className="h4 mb-2">
              {t('youre_joining_x_as_y', { projectName, email })}
            </h1>
            <div className="mb-4">
              {t(
                'your_name_and_email_address_will_be_visible_to_project_editors'
              )}
            </div>
            <OLButton
              variant="primary"
              size="lg"
              disabled={isLoading}
              isLoading={isLoading}
              loadingLabel={`${t('joining')}…`}
              onClick={submitHandler}
            >
              {t('join_project_lowercase')}
            </OLButton>
          </div>
        </OLCol>
      </OLRow>
    </div>
  )
}

export default Invite
