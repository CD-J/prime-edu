/* App-owned selection surfaces. Original selects stay as value/storage owners;
   browser menus are never opened and no account/learning writer lives here. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.PrimeStyledSelects = api; api.start(document, root); }
})(typeof window === 'object' ? window : this, () => {
  const model = input => [...input.options].map(o => ({ value:o.value, label:o.text, disabled:Boolean(o.disabled || (o.parentElement?.tagName === 'OPTGROUP' && o.parentElement.disabled)) }));
  const nextOption = (items, value, key) => {
    const available = items.filter(o => !o.disabled);
    if (!available.length) return null;
    const index = Math.max(0, available.findIndex(o => o.value === value));
    if (key === 'Home') return available[0].value;
    if (key === 'End') return available.at(-1).value;
    return available[(index + (['ArrowRight','ArrowDown'].includes(key) ? 1 : -1) + available.length) % available.length].value;
  };
  function start(doc, win) {
    const controls = new Map(), svg = name => win.PrimeUI.svg(name);
    const sheet = doc.createElement('section');
    sheet.className = 'prime-selection-sheet'; sheet.hidden = true;
    sheet.setAttribute('role','dialog'); sheet.setAttribute('aria-modal','true'); sheet.setAttribute('aria-labelledby','primeSelectionTitle');
    sheet.innerHTML = `<div class="prime-selection-card"><header><h2 id="primeSelectionTitle"></h2><button type="button" aria-label="선택 화면 닫기">${svg('close')}</button></header><div class="prime-selection-list" role="listbox"></div></div>`;
    doc.body.append(sheet);
    const list = sheet.querySelector('[role=listbox]'); let active = null, inertState = [];
    const nameFor = input => input.getAttribute('aria-label') || [...(input.closest('label')?.childNodes || [])].find(n => n.nodeType === 3 && n.textContent.trim())?.textContent.trim() || '선택';
    function close(restore = true) {
      if (sheet.hidden) return;
      const owner = active; active = null; sheet.hidden = true;
      doc.body.classList.remove('selection-sheet-open');
      inertState.forEach(([node,was]) => node.inert = was); inertState = [];
      if (restore && owner?.trigger.getClientRects().length) owner.trigger.focus({preventScroll:true});
    }
    function focusCurrent(input) {
      win.requestAnimationFrame(() => {
        const current = input.isConnected ? input : input.id ? doc.getElementById(input.id) : null;
        const control = controls.get(current);
        const target = control?.box.querySelector('button[aria-checked=true]') || control?.trigger;
        if (target && !target.disabled && target.getClientRects().length) target.focus({preventScroll:true});
      });
    }
    function choose(control, value) {
      const {input} = control;
      if (!input.isConnected || input.matches(':disabled') || !model(input).some(o => o.value === value && !o.disabled)) { close(); return; }
      close(false);
      if (input.value !== value) {
        input.value = value;
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
      }
      scan(); focusCurrent(input);
    }
    function open(control) {
      control.sync();
      if (control.locked || !control.input.isConnected) return;
      if (!sheet.hidden) close(false);
      active = control;
      sheet.querySelector('h2').textContent = nameFor(control.input);
      list.setAttribute('aria-label',nameFor(control.input)); list.replaceChildren();
      model(control.input).forEach(o => {
        const b = doc.createElement('button'); b.type = 'button'; b.setAttribute('role','option');
        b.setAttribute('aria-selected',String(o.value === control.input.value)); b.disabled = o.disabled;
        const text = doc.createElement('span'); text.textContent = o.label;
        b.append(text); if (o.value === control.input.value) b.insertAdjacentHTML('beforeend',svg('check'));
        b.addEventListener('click',() => choose(control,o.value)); list.append(b);
      });
      sheet.hidden = false; doc.body.classList.add('selection-sheet-open');
      inertState = [...doc.body.children].filter(n => n !== sheet && !['SCRIPT','STYLE','LINK'].includes(n.tagName)).map(n => [n,n.inert]);
      inertState.forEach(([n]) => n.inert = true);
      const selected = list.querySelector('[aria-selected=true]:not([disabled])') || list.querySelector('button:not([disabled])');
      (selected || sheet.querySelector('header button')).focus({preventScroll:true});
      selected?.scrollIntoView({block:'nearest'});
    }
    function mount(input) {
      if (controls.has(input) || input.matches('[aria-hidden=true],.prime-picker-source,[data-journey-wheel]')) return;
      const box = doc.createElement('div'); box.className = 'prime-styled-select';
      const fixed = doc.createElement('span'); fixed.className = 'prime-select-fixed';
      const segments = doc.createElement('div'); segments.className = 'prime-select-segments prime-choice-picker'; segments.setAttribute('role','radiogroup');
      const trigger = doc.createElement('button'); trigger.type = 'button'; trigger.className = 'prime-select-trigger'; trigger.setAttribute('aria-haspopup','dialog');
      trigger.innerHTML = `<span></span>${svg('sliders')}`;
      box.append(fixed,segments,trigger); input.after(box);
      input.closest('label')?.classList.add('prime-select-owner');
      input.classList.add('prime-select-source'); input.tabIndex = -1; input.setAttribute('aria-hidden','true');
      const control = {input,box,trigger,locked:false,sync,dispose:() => lens?.destroy()}; controls.set(input,control);
      let signature = '', optionSignature = '', lens = null;
      function sync() {
        const options = model(input), name = nameFor(input), locked = input.matches(':disabled') || options.filter(o => !o.disabled).length <= 1;
        const key = JSON.stringify([options,input.value,locked,name]); if (key === signature) return; signature = key;
        control.locked = locked;
        if (active === control) close();
        const label = options.find(o => o.value === input.value)?.label || '선택';
        fixed.textContent = label; trigger.querySelector('span').textContent = label;
        trigger.setAttribute('aria-label',`${name}: ${label}`); trigger.disabled = locked;
        segments.setAttribute('aria-label',name); box.dataset.mode = locked ? 'fixed' : options.length <= 3 ? 'segments' : 'sheet';
        fixed.hidden = !locked; segments.hidden = locked || options.length > 3; trigger.hidden = locked || options.length <= 3;
        const optionKey = JSON.stringify(options);
        if (optionKey !== optionSignature) {
          optionSignature = optionKey; segments.querySelectorAll('button').forEach(b => b.remove());
          options.forEach(o => {
            const b = doc.createElement('button'); b.type = 'button'; b.textContent = o.label; b.dataset.value = o.value;
            b.setAttribute('role','radio'); b.disabled = o.disabled;
            b.addEventListener('click',() => choose(control,o.value)); segments.append(b);
          });
        }
        segments.querySelectorAll('button').forEach(b => { const selected = b.dataset.value === input.value; b.disabled = locked || options.find(o => o.value === b.dataset.value)?.disabled; b.setAttribute('aria-checked',String(selected)); b.tabIndex = selected && !locked && !b.disabled ? 0 : -1; });
        if (win.PrimeLiquidTabs && !lens) lens = win.PrimeLiquidTabs.create(segments,'button[role=radio]',win);
        lens?.sync();
      }
      segments.addEventListener('keydown',e => {
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key) || control.locked) return;
        e.preventDefault(); e.stopPropagation(); const next = nextOption(model(input),input.value,e.key); if (next !== null) choose(control,next);
      });
      trigger.addEventListener('click',() => open(control));
      trigger.addEventListener('keydown',e => { if (['ArrowUp','ArrowDown'].includes(e.key)) { e.preventDefault(); open(control); } });
      input.addEventListener('change',sync); sync();
    }
    function scan() {
      for (const [input,control] of controls) if (!input.isConnected) { if (active?.input === input) close(false); control.dispose(); controls.delete(input); }
      doc.querySelectorAll('select').forEach(mount); controls.forEach(c => c.sync());
    }
    sheet.querySelector('header button').addEventListener('click',() => close());
    sheet.addEventListener('click',e => { if (e.target === sheet) close(); });
    sheet.addEventListener('keydown',e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      const options = [...list.querySelectorAll('button:not([disabled])')];
      if (['ArrowUp','ArrowDown','Home','End'].includes(e.key) && options.length) {
        e.preventDefault(); const index = Math.max(0,options.indexOf(doc.activeElement));
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length-1 : Math.max(0,Math.min(options.length-1,index+(e.key === 'ArrowDown' ? 1 : -1)));
        options[next].focus(); options[next].scrollIntoView({block:'nearest'});
      }
      if (e.key === 'Tab') {
        const focusable = [sheet.querySelector('header button'),...options], first = focusable[0], last = focusable.at(-1);
        if (e.shiftKey && doc.activeElement === first) {e.preventDefault();last.focus();}
        else if (!e.shiftKey && doc.activeElement === last) {e.preventDefault();first.focus();}
      }
    });
    // Capture restores the sheet's inert state before a journey popstate closes
    // its own dialog, so browser Back cannot leave the whole app inert.
    win.addEventListener('popstate',() => close(false),true);
    doc.addEventListener('reset',() => win.requestAnimationFrame(scan),true);
    win.addEventListener('prime:controls-sync',scan);
    new win.MutationObserver(scan).observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','selected','aria-label','hidden']});
    scan(); return {sync:scan,close};
  }
  return {model,nextOption,start};
});
