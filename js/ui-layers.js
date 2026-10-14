/* Escape ancestor transforms/stacking contexts without recreating UI or handlers. */
(() => {
  const portalIds = ['homeSettingsBackdrop','homeSettingsPanel','mobileChatDrawerBackdrop',
    'mobileChatDrawer','desktopChatHistoryBackdrop','desktopChatHistory','notificationPopover'];
  portalIds.forEach(id => {
    const element = document.getElementById(id);
    if (element) document.body.append(element);
  });
  const surfaces = [...document.querySelectorAll('.modal-backdrop,.sheet-backdrop,.utility-modal-backdrop'),
    ...['homeSettingsPanel','mobileChatDrawer','desktopChatHistory','notificationPopover','primeReviewView','primeActivityView'].map(id => document.getElementById(id)).filter(Boolean)];
  const notification = document.getElementById('notificationPopover');
  const homeSettings = document.getElementById('homeSettingsPanel');
  let notificationFrame = 0;
  const positionNotification = () => {
    if (!notification || notification.hidden) return;
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    const x = viewport?.offsetLeft || 0, y = viewport?.offsetTop || 0;
    const anchor = document.getElementById('notificationButton')?.getBoundingClientRect();
    const nav = document.querySelector('.bottom-nav')?.getBoundingClientRect();
    const bottom = nav && nav.height && nav.top > y ? Math.min(y + height - 12, nav.top - 12) : y + height - 12;
    const panelWidth = Math.min(390, width - 24);
    const left = Math.max(x + 12, Math.min((anchor?.right || x + width - 12) - panelWidth, x + width - panelWidth - 12));
    const top = Math.max(y + 12, Math.min((anchor?.bottom || y + 12) + 12, bottom - Math.min(220, height * .5)));
    notification.style.setProperty('--notice-left', `${left}px`);
    notification.style.setProperty('--notice-top', `${top}px`);
    notification.style.setProperty('--notice-width', `${panelWidth}px`);
    notification.style.setProperty('--notice-height', `${Math.max(80, bottom - top)}px`);
  };
  const positionHomeSettings = () => {
    if (!homeSettings || homeSettings.hidden || window.innerWidth < 1000) return;
    const view=window.visualViewport,width=view?.width||window.innerWidth,height=view?.height||window.innerHeight;
    const x=view?.offsetLeft||0,y=view?.offsetTop||0,edge=12;
    const anchor=document.getElementById('homeSettingsButton')?.getBoundingClientRect();
    const panelWidth=Math.min(390,Math.max(0,width-edge*2)),maxHeight=Math.max(0,height-edge*2);
    homeSettings.style.setProperty('--home-panel-width',`${panelWidth}px`);
    homeSettings.style.setProperty('--home-panel-height',`${maxHeight}px`);
    // Measure the settled layout, not the popover's in-progress scale transform.
    const panelHeight=Math.min(homeSettings.offsetHeight||homeSettings.scrollHeight||maxHeight,maxHeight);
    const left=Math.max(x+edge,Math.min((anchor?.right||x+width-edge)-panelWidth,x+width-panelWidth-edge));
    const top=Math.max(y+edge,Math.min((anchor?.bottom||y+edge)+12,y+height-panelHeight-edge));
    homeSettings.style.setProperty('--home-panel-left',`${left}px`);
    homeSettings.style.setProperty('--home-panel-top',`${top}px`);
  };
  const schedulePosition = () => {
    if ((!notification||notification.hidden)&&(!homeSettings||homeSettings.hidden)||notificationFrame) return;
    notificationFrame = requestAnimationFrame(() => { notificationFrame = 0; positionNotification(); positionHomeSettings(); });
  };
  window.PrimeNotificationLayout = { position: positionNotification };
  window.PrimeHomeSettingsLayout = { position: positionHomeSettings };
  window.addEventListener('resize', schedulePosition);
  window.addEventListener('scroll', schedulePosition, { passive: true });
  window.visualViewport?.addEventListener('resize', schedulePosition);
  window.visualViewport?.addEventListener('scroll', schedulePosition);
  if (typeof ResizeObserver !== 'undefined') {
    const resize = new ResizeObserver(schedulePosition);
    ['notificationButton','homeSettingsButton','homeSettingsPanel'].forEach(id => { const node = document.getElementById(id); if (node) resize.observe(node); });
  }
  const sync = () => {
    positionNotification();
    positionHomeSettings();
    const blocked = surfaces.some(element => element.matches('.modal-backdrop,.sheet-backdrop,.utility-modal-backdrop')
      ? element.classList.contains('is-open') : !element.hidden);
    document.body.classList.toggle('has-blocking-overlay', blocked);
  };
  // Observe only overlay state, never the whole document or the class we update.
  const observer = new MutationObserver(sync);
  surfaces.forEach(element => observer.observe(element,{attributes:true,attributeFilter:['class','hidden']}));
  sync();
})();
