import { useSplitTestContext } from '../context/split-test-context'
import BetaBadge from './beta-badge'

type TooltipProps = {
  id?: string
  className?: string
}

type SplitTestBadgeProps = {
  splitTestName: string
  displayOnVariants: string[]
  tooltip?: TooltipProps
}

export default function SplitTestBadge({
  splitTestName,
  displayOnVariants,
  tooltip = {},
}: SplitTestBadgeProps) {
  const { splitTestVariants, splitTestInfo } = useSplitTestContext()

  const testInfo = splitTestInfo[splitTestName]
  if (!testInfo) {
    return null
  }

  const variant = splitTestVariants[splitTestName]
  if (!variant || !displayOnVariants.includes(variant)) {
    return null
  }

  return (
    <BetaBadge
      tooltip={{
        id: tooltip.id || `${splitTestName}-badge-tooltip`,
        className: `split-test-badge-tooltip ${tooltip.className}`,
        text: testInfo.badgeInfo?.tooltipText || (
          <>
            We are testing this new feature.
            <br />
            Click to give feedback
          </>
        ),
      }}
      phase={testInfo.phase}
      link={{
        href: testInfo.badgeInfo?.url?.length
          ? testInfo.badgeInfo?.url
          : undefined,
      }}
    />
  )
}
