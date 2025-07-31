export const isFormSubmitKeypressEvent = (
  event: React.KeyboardEvent<HTMLTextAreaElement>
) => {
  return (
    event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey
  )
}
