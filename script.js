const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');

toggle?.addEventListener('click', () => {
  links?.classList.toggle('open');
});

// Close the mobile menu after tapping a link
links?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => links.classList.remove('open'));
});

// Keep the footer year current
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();
