(() => {
  'use strict';
  const language = document.querySelector('.guide-language-select');
  language?.addEventListener('change', () => {
    const destination = new URL(language.value, document.baseURI);
    if (location.hash && document.getElementById(location.hash.slice(1))) destination.hash = location.hash;
    try { localStorage.setItem('ziaforge-site-language', language.options[language.selectedIndex].lang || 'en'); } catch {}
    location.href = destination.href;
  });
  const links = Array.from(document.querySelectorAll('.guide-sidebar nav a'));
  const sections = links.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
  const normalize = text => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(document.documentElement.lang);
  const records = links.map(link => ({ link, text: normalize((document.getElementById(link.hash.slice(1))?.textContent || '') + ' ' + link.textContent) }));
  const search = document.querySelector('.guide-search');
  const empty = document.querySelector('.guide-empty');
  search?.addEventListener('input', () => {
    const words = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    let visible = 0;
    records.forEach(record => {
      const matched = words.every(word => record.text.includes(word));
      record.link.hidden = !matched;
      if (matched) visible++;
    });
    if (empty) empty.hidden = visible !== 0;
  });
  search?.addEventListener('keydown', event => {
    if (event.key === 'Escape') { search.value = ''; search.dispatchEvent(new Event('input')); }
    if (event.key === 'Enter') {
      const first = links.find(link => !link.hidden);
      if (first) { event.preventDefault(); first.click(); document.getElementById(first.hash.slice(1))?.focus({ preventScroll: true }); }
    }
  });
  sections.forEach(section => section.setAttribute('tabindex', '-1'));
  const progress = document.querySelector('.guide-progress');
  let scheduled = false;
  const update = () => {
    scheduled = false;
    const height = document.documentElement.scrollHeight - innerHeight;
    if (progress) progress.style.width = `${height > 0 ? (scrollY / height) * 100 : 0}%`;
    let active = sections[0];
    for (const section of sections) { if (section.getBoundingClientRect().top <= 155) active = section; else break; }
    links.forEach(link => {
      if (active && link.hash === `#${active.id}`) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  };
  addEventListener('scroll', () => { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();
})();
