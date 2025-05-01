import { FC } from 'react'

export const PdfPreviewMessages: FC<React.PropsWithChildren> = ({
  children,
}) => {
  return <div className="pdf-preview-messages">{children}</div>
}
