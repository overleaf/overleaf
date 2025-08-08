import Tag from '@/shared/components/tag'
import { forwardRef } from 'react'

type OLTagProps = React.ComponentProps<typeof Tag>

const OLTag = forwardRef<HTMLElement, OLTagProps>((props: OLTagProps, ref) => {
  return <Tag ref={ref} {...props} />
})

OLTag.displayName = 'OLTag'

export default OLTag
