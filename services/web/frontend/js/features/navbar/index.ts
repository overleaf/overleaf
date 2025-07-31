const toggleButton = document.getElementById('navbar-toggle-btn') as HTMLElement

toggleButton?.addEventListener('click', () => {
  // Delay allows Bootstrap to update aria-expanded first
  setTimeout(() => {
    const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true'
    document.body.classList.toggle('no-scroll', isExpanded)
  }, 5)
})
