import { useState } from 'react'
import LabsExperimentWidget from '../../shared/components/labs/labs-experiments-widget'
import { isInExperiment } from '@/utils/labs-utils'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

const MonthlyTexliveLabsWidget = ({
  labsProgram,
  setErrorMessage,
}: {
  labsProgram: boolean
  setErrorMessage: (err: string) => void
}) => {
  const { t } = useTranslation()
  const [optedIn, setOptedIn] = useState(isInExperiment('monthly-texlive'))

  const monthlyTexLiveSplitTestEnabled = isSplitTestEnabled('monthly-texlive')
  if (!monthlyTexLiveSplitTestEnabled) {
    return null
  }

  const logo = (
    <MaterialIcon
      type="construction"
      size="2x"
      className="rounded bg-primary-subtle"
    />
  )
  return (
    <LabsExperimentWidget
      description={t('test_more_recent_versions_of_texlive')}
      experimentName="monthly-texlive"
      logo={logo}
      labsEnabled={labsProgram}
      setErrorMessage={setErrorMessage}
      optedIn={optedIn}
      setOptedIn={setOptedIn}
      title={t('rolling_texlive_build')}
    />
  )
}

export default MonthlyTexliveLabsWidget
