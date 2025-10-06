// Lightweight toast/notification utility
// Usage: showToast(message, { type: 'success'|'error'|'info'|'warning', timeout: ms })
// Falls back gracefully if container not yet present.

const TOAST_CONTAINER_ID = 'appToastContainer';

function ensureToastContainer(){
  let c = document.getElementById(TOAST_CONTAINER_ID);
  if (!c){
    c = document.createElement('div');
    c.id = TOAST_CONTAINER_ID;
    c.style.position='fixed';
    c.style.top='1rem';
    c.style.right='1rem';
    c.style.zIndex='1080';
    c.style.display='flex';
    c.style.flexDirection='column';
    c.style.gap='0.5rem';
    document.body.appendChild(c);
  }
  return c;
}

function showToast(msg, opts={}){
  try {
    const { type='info', timeout=4000 } = opts;
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    const colors = { success:'bg-success text-white', error:'bg-danger text-white', info:'bg-primary text-white', warning:'bg-warning text-dark' };
    toast.className = `toast shadow-sm fade show ${colors[type]||colors.info}`;
    toast.style.padding='0.75rem 1rem';
    toast.style.borderRadius='0.375rem';
    toast.style.fontSize='0.875rem';
    toast.style.pointerEvents='auto';
    toast.innerHTML = `<div class="d-flex align-items-start gap-2"><div class="flex-grow-1">${msg}</div><button type="button" aria-label="Close" class="btn btn-sm btn-light" style="line-height:1;padding:0 .4rem;">×</button></div>`;
    const closeBtn = toast.querySelector('button');
    closeBtn.addEventListener('click', ()=> remove());
    function remove(){ if(!toast) return; toast.classList.remove('show'); setTimeout(()=> toast.remove(), 150); }
    container.appendChild(toast);
    if (timeout>0) setTimeout(remove, timeout);
    return { remove };
  } catch(e){
    // Fallback
    alert(msg);
  }
}

// Expose globally
window.showToast = showToast;
