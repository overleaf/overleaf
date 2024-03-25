import { FC, ComponentProps, Suspense } from 'react'

const style = { width: 785, height: 785 }

export const TestContainer: FC<ComponentProps<'div'>> = ({
  children,
  ...rest
}) => (
  <div style={style} {...rest}>
    <Suspense fallback={null}>{children}</Suspense>
  </div>
)
