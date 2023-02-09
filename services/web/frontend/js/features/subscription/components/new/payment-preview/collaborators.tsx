import { useTranslation } from 'react-i18next'
import { Plan } from '../../../../../../../types/subscription/plan'

function CollaboratorsWrapper({ children }: { children: React.ReactNode }) {
  return <div className="text-small number-of-collaborators">{children}</div>
}

type CollaboratorsProps = {
  count: NonNullable<Plan['features']>['collaborators']
}

function Collaborators({ count }: CollaboratorsProps) {
  const { t } = useTranslation()

  if (count === 1) {
    return (
      <CollaboratorsWrapper>
        {t('collabs_per_proj_single', { collabcount: 1 })}
      </CollaboratorsWrapper>
    )
  }

  if (count > 1) {
    return (
      <CollaboratorsWrapper>
        {t('collabs_per_proj', { collabcount: count })}
      </CollaboratorsWrapper>
    )
  }

  if (count === -1) {
    return <CollaboratorsWrapper>{t('unlimited_collabs')}</CollaboratorsWrapper>
  }

  return null
}

export default Collaborators
