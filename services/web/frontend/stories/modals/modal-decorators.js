/**
 * Wrap modal content in modal classes, without modal behaviours
 */

export function ModalContentDecorator(Story) {
  return (
    <div className="modal-dialog">
      <div className="modal-content">
        <Story />
      </div>
    </div>
  )
}

export function ModalBodyDecorator(Story) {
  return (
    <div className="modal-body">
      <Story />
    </div>
  )
}

export function ModalFooterDecorator(Story) {
  return (
    <div className="modal-footer">
      <Story />
    </div>
  )
}
