import { useState } from 'react'
import LabsExperimentWidget from '../../../shared/components/labs/labs-experiments-widget'
import { isInExperiment } from '@/utils/labs-utils'
import { useTranslation } from 'react-i18next'
import labsIcon from '../images/labs-icon.svg'

const EditorRedesignLabsWidget = ({
  labsProgram,
  setErrorMessage,
}: {
  labsProgram: boolean
  setErrorMessage: (err: string) => void
}) => {
  const { t } = useTranslation()
  const [optedIn, setOptedIn] = useState(isInExperiment('editor-redesign'))
  return (
    <LabsExperimentWidget
      description={t(
        'access_your_favourite_features_faster_with_our_new_streamlined_editor'
      )}
      experimentName="editor-redesign"
      logo={<img src={labsIcon} alt="" aria-hidden="true" />}
      labsEnabled={labsProgram}
      setErrorMessage={setErrorMessage}
      optedIn={optedIn}
      setOptedIn={setOptedIn}
      title={t('new_overleaf_editor')}
    />
  )
}

export default EditorRedesignLabsWidget
