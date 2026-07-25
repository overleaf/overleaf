import { useTranslation } from 'react-i18next'
import OLButton from '@/shared/components/ol/ol-button'
import getMeta from '@/utils/meta'
import { useSplitTest } from '@/shared/context/split-test-context'

export default function GiveFeedbackLink() {
  const { t } = useTranslation()
  const isProfessionalGroupPlan = getMeta('ol-user')?.isProfessionalGroupPlan
  const { info } = useSplitTest('sharing-updates')

  let link: string
  if (info?.phase === 'labs') {
    link =
      'https://docs.google.com/forms/d/e/1FAIpQLSeOsPzSw8lWLY310ZvR7BCK08v3Puc4JWFdV6K3m9QbsL2OSw/viewform'
  } else if (isProfessionalGroupPlan) {
    link = 'https://forms.gle/rz1JDMuNajWG4ZY49'
  } else {
    link = 'https://forms.gle/WLEjzG4Ayp8zFscM9'
  }

  return (
    <OLButton
      variant="link"
      size="sm"
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="fw-bold"
    >
      {t('give_feedback')}
    </OLButton>
  )
}
