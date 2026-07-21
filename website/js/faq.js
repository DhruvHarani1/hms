export function initFaq() {
  const items = document.querySelectorAll('.faq__item');

  items.forEach((item) => {
    const question = item.querySelector('.faq__question');

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close all others
      items.forEach((other) => other.classList.remove('active'));

      // Toggle clicked
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}
