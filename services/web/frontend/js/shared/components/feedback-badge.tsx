import BetaBadge from './beta-badge'
import { FC, ReactNode, useMemo } from 'react'

export const FeedbackBadge: FC<{
  url: string
  id: string
  text?: ReactNode
}> = ({ url, id, text }) => {
  const tooltip = useMemo(() => {
    return {
      id: `${id}-tooltip`,
      text: text || <DefaultContent />,
    }
  }, [id, text])

  return <BetaBadge tooltip={tooltip} phase="release" link={{ href: url }} />
}

const DefaultContent = () => (
  <>
    We are testing this new feature.
    <br />
    Click to give feedback
  </>
)
