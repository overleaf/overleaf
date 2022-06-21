import Tooltip from './tooltip'

type Props = {
  placement: string
}

export default function StopOnFirstErrorBadge({ placement }: Props) {
  const content = (
    <>
      We are testing the “Stop on first error” compilation mode.
      <br />
      Click to give feedback
    </>
  )

  return (
    <Tooltip
      id="stop-on-first-error-badge"
      description={content}
      overlayProps={{ placement, delayHide: 100 }}
      tooltipProps={{ className: 'tooltip-wide' }}
    >
      <a
        href="https://forms.gle/7M8821o5RDZrFKoF6"
        target="_blank"
        rel="noopener noreferrer"
        className="badge info-badge"
      >
        <span className="sr-only">{content}</span>
      </a>
    </Tooltip>
  )
}
