import LabsExperimentWidget, {
  LabsExperimentWidgetProps,
} from '@/shared/components/labs/labs-experiments-widget'
import MaterialIcon from '@/shared/components/material-icon'
import { isInExperiment } from '@/utils/labs-utils'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { useState } from 'react'

type LabsWidgetProps = Pick<LabsExperimentWidgetProps, 'setErrorMessage'> & {
  labsProgram: boolean
}

const LabsWidget = ({ setErrorMessage, labsProgram }: LabsWidgetProps) => {
  const [optedIn, setOptedIn] = useState(isInExperiment('overleaf-code'))

  if (!isSplitTestEnabled('overleaf-code')) {
    return null
  }

  const description = (
    <span>
      Run Python code while editing <code>.py</code> files
    </span>
  )

  return (
    <LabsExperimentWidget
      description={description}
      experimentName="overleaf-code"
      title="Overleaf Code (Python execution)"
      setOptedIn={setOptedIn}
      setErrorMessage={setErrorMessage}
      optedIn={optedIn}
      logo={
        <MaterialIcon
          type="code"
          size="2x"
          className="rounded bg-primary-subtle"
        />
      }
      optedInDescription={description}
      labsEnabled={labsProgram}
    />
  )
}

export const hidden = () => !isSplitTestEnabled('overleaf-code')

export default LabsWidget
