export function swapModal(selectorBefore, selectorAfter) {
  const modalBefore = $(selectorBefore)
  const modalAfter = $(selectorAfter)

  // Disable the fade-out + fade-in animation when swapping the forms.
  modalBefore.removeClass('fade')
  modalAfter.removeClass('fade')
  modalAfter.modal()
  modalBefore.modal('hide')
  modalBefore.addClass('fade')
  modalAfter.addClass('fade')
}
