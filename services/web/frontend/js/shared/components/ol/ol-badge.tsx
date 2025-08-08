import Badge from '@/shared/components/badge/badge'

function OLBadge(props: React.ComponentProps<typeof Badge>) {
  let { bg, text, ...rest } = props

  // For warning badges, use a light background by default. We still want the
  // Bootstrap warning colour to be dark for text though, so make an
  // adjustment here
  if (bg === 'warning') {
    bg = 'warning-light-bg'
    text = 'warning'
  }

  return <Badge bg={bg} text={text} {...rest} />
}

export default OLBadge
