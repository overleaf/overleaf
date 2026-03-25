import React from 'react'
import MaterialIcon from '@/shared/components/material-icon'

type LabsExperimentIconProps = {
  icon: string
}

const LabsExperimentIcon: React.FC<LabsExperimentIconProps> = ({ icon }) => {
  if (!icon) {
    return null
  }

  return (
    <MaterialIcon
      type={icon}
      className="rounded bg-primary-subtle labs-experiment-icon"
    />
  )
}

export default LabsExperimentIcon
