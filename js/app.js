(()=>{
  "use strict";
  const track=(n,p)=>window.gtag&&gtag('event',n,p||{});
  async function applyServiceStatus(){
    const cfg=window.RGM_CONFIG||{}, base=String(cfg.PUBLIC_API_BASE||'').replace(/\/$/,'');
    if(!base)return;
    try{
      const r=await fetch(base+'/pricing',{cache:'no-store'});
      if(!r.ok)return;
      const d=await r.json();
      if(d.service_enabled!==false)return;
      document.querySelectorAll('a[href="/create.html"],a[href="create.html"]').forEach(a=>{
        a.dataset.originalText=a.textContent; a.textContent='Service Temporarily Unavailable'; a.setAttribute('aria-disabled','true'); a.classList.add('service-disabled-link');
        a.addEventListener('click',e=>{e.preventDefault();});
      });
      const banner=document.createElement('div');
      banner.className='service-unavailable-banner';
      banner.innerHTML='<strong>Service Temporarily Unavailable</strong><span>'+String(d.service_message||'Please come back later.').replace(/[<>&"\']/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#039;'}[m]))+'</span>';
      document.body.prepend(banner);
    }catch{}
  }
  applyServiceStatus();
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
