import { useTranslation } from 'react-i18next'
import { ShareProjectContextValue } from '@/features/share-project-modal/components/share-project-modal'

function ErrorMessage({ error }: Pick<ShareProjectContextValue, 'error'>) {
  const { t } = useTranslation()
  switch (error) {
    case 'cannot_invite_non_user':
      return <>{t('cannot_invite_non_user')}</>

    case 'cannot_verify_user_not_robot':
      return <>{t('cannot_verify_user_not_robot')}</>

    case 'cannot_invite_self':
      return <>{t('cannot_invite_self')}</>

    case 'invalid_email':
      return <>{t('invalid_email')}</>

    case 'too_many_requests':
      return <>{t('too_many_requests')}</>

    case 'invite_expired':
      return <>{t('invite_expired')}</>

    case 'invite_resend_limit_hit':
      return <>{t('invite_resend_limit_hit')}</>

    case 'user_suspended':
      return <>Cannot share projects with a suspended user account.</>

    default:
      if (
        error &&
        error !== 'generic_something_went_wrong' &&
        error.includes(' ')
      ) {
        return <>{error}</>
      }
      return <>{t('generic_something_went_wrong')}</>
  }
}

export default ErrorMessage
