import React, { FC, ReactNode } from 'react'

type Props = { children: ReactNode; isMain?: boolean; alt?: boolean }

const ContentLayout: FC<Props> = ({ children, isMain, alt }: Props) => {
  const className = alt ? 'content content-alt' : 'content'
  return isMain ? (
    <main className={className} id="main-content">
      {children}
    </main>
  ) : (
    <div className={className}>{children}</div>
  )
}

export default ContentLayout
