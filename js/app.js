(()=>{
  "use strict";
  const track=(n,p)=>window.gtag&&gtag('event',n,p||{});
  document.querySelectorAll('[data-event]').forEach(e=>e.addEventListener('click',()=>track(e.dataset.event)));
  if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
  const tabs=document.querySelectorAll('.tab');
  tabs.forEach(t=>t.addEventListener('click',()=>{
    tabs.forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('panel-'+t.dataset.tab)?.classList.add('active');
  }));
  document.querySelectorAll('header.site-header').forEach(header=>{
    if(header.closest('body')?.dataset?.admin==='true') return;
    if(header.querySelector('.header-tools') || header.querySelector('a[href="/track-order.html"]')) return;
    const tools=document.createElement('div');
    tools.className='header-tools';
    tools.innerHTML='<a class="header-link" href="/track-order.html">Track Order</a><a class="header-link studio-link" href="/admin/">Studio</a>';
    header.appendChild(tools);
  });
})();
