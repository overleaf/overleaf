import React from 'react'

function LabeledDivider({ children }: { children: string }) {
  return (
    <div className="labeled-divider">
      <span>{children}</span>
    </div>
  )
}

export default LabeledDivider
