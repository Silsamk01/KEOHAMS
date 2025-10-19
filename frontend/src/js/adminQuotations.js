// Admin Quotations Management Module
// Handles list, filter, detail, reply (logistics/discount/methods/notes), mark paid, cancel

const AQ_API = 'http://localhost:4000/api/quotations/admin';

function aqToken(){ return localStorage.getItem('token'); }
function aqHeaders(){ const t = aqToken(); return t? { Authorization: 'Bearer '+t } : {}; }
async function aqFetch(url, opts={}){ const res = await fetch(url, { ...opts, headers: { 'Content-Type':'application/json', ...(opts.headers||{}), ...aqHeaders() } }); if(!res.ok) throw new Error((await res.text())||'Request failed'); return res.json(); }

const aqState = { page:1, pageSize:25, status:'', user_id:'', list:[], total:0, selectedId:null };

function aqFmtMoney(v){ return Number(v||0).toLocaleString(undefined,{ style:'currency', currency:'USD', minimumFractionDigits:2 }); }
function aqStatusColor(s){ return ({ REQUESTED:'secondary', REPLIED:'warning', FULFILLMENT_PENDING:'info', PAID:'success', CANCELLED:'dark' })[s]||'secondary'; }
function aqEscape(s){ return (s==null?'':String(s)).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c])); }

export async function loadAdminQuotations(){
  const listEl = document.getElementById('adminQuoList'); if(!listEl) return;
  listEl.innerHTML = '<div class="p-3 small text-muted">Loading…</div>';
  try {
    const params = new URLSearchParams({ page:String(aqState.page), pageSize:String(aqState.pageSize) });
    if(aqState.status) params.set('status', aqState.status);
    if(aqState.user_id) params.set('user_id', aqState.user_id);
    const data = await aqFetch(`${AQ_API}?${params.toString()}`);
    aqState.list = data.data||[]; aqState.total = data.total||aqState.list.length; renderAdminQuoList();
    updateAdminQuoBadge();
  } catch(e){ listEl.innerHTML = `<div class="p-3 small text-danger">${aqEscape(e.message||'Failed')}</div>`; }
}

function renderAdminQuoList(){
  const listEl = document.getElementById('adminQuoList'); if(!listEl) return;
  listEl.innerHTML='';
  if(!aqState.list.length){ listEl.innerHTML = '<div class="p-3 text-muted small">No quotations.</div>'; renderAdminQuoDetail(null); return; }
  const badge = document.getElementById('adminQuoCountBadge'); if(badge){ badge.textContent=String(aqState.total); badge.classList.remove('d-none'); }
  aqState.list.forEach(q=>{
  const btn = document.createElement('button'); btn.type='button'; btn.className='list-group-item list-group-item-action d-flex justify-content-between align-items-start';
  const userLine = (q.user_name || q.user_email) ? `<div class=\"text-truncate small\" style=\"max-width:180px;\">${aqEscape(q.user_name || '')} ${q.user_email? '· '+aqEscape(q.user_email):''}</div>` : '';
  const subtotalTip = typeof q.subtotal_amount !== 'undefined' ? ` title=\"Subtotal ${aqFmtMoney(q.subtotal_amount)}\"` : '';
  btn.innerHTML = `<div class=\"me-2\"${subtotalTip}><div class=\"fw-semibold\">${q.reference}</div>${userLine}<div class=\"small text-muted\">${q.status} · ${q.items_count||0} items</div></div><span class=\"badge rounded-pill text-bg-${aqStatusColor(q.status)}\">${q.status}</span>`;
    btn.addEventListener('click', ()=> selectAdminQuo(q.id));
    if(q.id === aqState.selectedId) btn.classList.add('active');
    listEl.appendChild(btn);
  });
  if(!aqState.selectedId && aqState.list.length){ selectAdminQuo(aqState.list[0].id); }
}

async function selectAdminQuo(id){
  aqState.selectedId = id;
  const body = document.getElementById('adminQuoDetailBody'); if(body) body.innerHTML='<div class="p-3 small text-muted">Loading…</div>';
  try { const q = await aqFetch(`${AQ_API}/${id}`); renderAdminQuoDetail(q); } catch(e){ if(body) body.innerHTML = `<div class=\"p-3 small text-danger\">${aqEscape(e.message||'Load failed')}</div>`; }
}

function summaryLine(q){
  const base = Number(q.subtotal_amount)||0, logistics=Number(q.logistics_amount)||0, discount=Number(q.discount_amount)||0, total=Number(q.total_amount)|| base + logistics - discount;
  return `Subtotal ${aqFmtMoney(base)} · Logistics ${aqFmtMoney(logistics)} · Discount ${aqFmtMoney(discount)} = Total <strong>${aqFmtMoney(total)}</strong>`;
}

function renderAdminQuoDetail(q){
  const title = document.getElementById('adminQuoDetailTitle');
  const body = document.getElementById('adminQuoDetailBody');
  const actions = document.getElementById('adminQuoDetailActions');
  const statusBadge = document.getElementById('adminQuoStatusBadge');
  const replyFooter = document.getElementById('adminQuoReplyFooter');
  const markPaidBtn = document.getElementById('adminQuoMarkPaidBtn');
  const cancelBtn = document.getElementById('adminQuoCancelBtn');
  if(!body) return;
  if(!q){ title.textContent='Select a quotation'; body.innerHTML='<div class="text-muted small">Choose a request on the left.</div>'; actions.style.display='none'; replyFooter.style.display='none'; return; }
  const userMeta = `${q.user_name? aqEscape(q.user_name)+' ':''}${q.user_email? '('+aqEscape(q.user_email)+')':''}`.trim();
  title.textContent = `${q.reference} · User #${q.user_id}${userMeta? ' · '+userMeta:''}`;
  statusBadge.textContent = q.status; statusBadge.className = `badge rounded-pill text-bg-${aqStatusColor(q.status)}`;
  actions.style.display='flex';
  body.innerHTML = `
    <div class="small mb-2 text-muted">Created ${new Date(q.created_at).toLocaleString()} · Updated ${new Date(q.updated_at).toLocaleString()}</div>
    <div class="mb-3">
      <div class="small text-muted mb-1">Items</div>
      <div class="table-responsive small">
        <table class="table table-sm align-middle mb-0">
          <thead><tr><th>Product</th><th class="text-end">Qty</th><th class="text-end">Unit</th><th class="text-end">Line</th></tr></thead>
          <tbody>${(q.items||[]).map(i=> `<tr><td>${aqEscape(i.product_name)}</td><td class="text-end">${i.quantity}</td><td class="text-end">${aqFmtMoney(i.unit_price)}</td><td class="text-end">${aqFmtMoney(i.line_total)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
    <div class="row g-3 small">
      <div class="col-md-6">
        <div class="fw-semibold mb-1">User Notes</div>
        <div class="border rounded p-2" style="min-height:54px;">${aqEscape(q.notes_user||'—')}</div>
      </div>
      <div class="col-md-6">
        <div class="fw-semibold mb-1">Admin Notes</div>
        <div class="border rounded p-2" style="min-height:54px;">${aqEscape(q.notes_admin||'—')}</div>
      </div>
    </div>
    <div class="mt-3">${summaryLine(q)}</div>
    ${q.allowed_payment_methods? `<div class="mt-2 small">Allowed methods: <code>${aqEscape(q.allowed_payment_methods)}</code></div>`:''}
  `;
  // Reply form population (only if REQUESTED or REPLIED not final)
  if(q.status === 'REQUESTED' || q.status === 'REPLIED') {
    replyFooter.style.display='block';
    document.getElementById('adminQuoLogistics').value = q.logistics_amount ?? '';
    document.getElementById('adminQuoDiscount').value = q.discount_amount ?? '';
    document.getElementById('adminQuoMethods').value = q.allowed_payment_methods || '';
    document.getElementById('adminQuoNotes').value = q.notes_admin || '';
  } else {
    replyFooter.style.display='none';
  }
  markPaidBtn.classList.toggle('d-none', q.status!=='REPLIED');
  cancelBtn.classList.toggle('d-none', q.status==='PAID' || q.status==='CANCELLED');
  // Wire buttons
  markPaidBtn.onclick = async ()=>{ if(!confirm('Mark as PAID?')) return; await aqAction(q.id,'mark-paid'); };
  cancelBtn.onclick = async ()=>{ if(!confirm('Cancel this quotation?')) return; await aqAction(q.id,'cancel'); };
  const form = document.getElementById('adminQuoReplyForm');
  if(form && !form.__wired){
    form.__wired = true;
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const id = aqState.selectedId; if(!id) return;
      const logistics_amount = parseFloat(document.getElementById('adminQuoLogistics').value||'0')||0;
      const discount_amount = parseFloat(document.getElementById('adminQuoDiscount').value||'0')||0;
      const allowed_payment_methods = document.getElementById('adminQuoMethods').value.trim();
      const notes_admin = document.getElementById('adminQuoNotes').value.trim();
      const statusEl = document.getElementById('adminQuoReplyStatus'); statusEl.textContent='Saving...';
      try {
        await aqFetch(`${AQ_API}/${id}/reply`, { method:'POST', body: JSON.stringify({ logistics_amount, discount_amount, allowed_payment_methods, notes_admin }) });
        statusEl.textContent='Saved'; setTimeout(()=>{ statusEl.textContent=''; },1500);
        await loadAdminQuotations();
        selectAdminQuo(id);
      } catch(err){ statusEl.textContent=err.message||'Failed'; }
    });
  }
}

async function aqAction(id, action){
  try { await aqFetch(`${AQ_API}/${id}/${action}`, { method:'POST', body: JSON.stringify({}) }); await loadAdminQuotations(); selectAdminQuo(id); }
  catch(e){ alert(e.message||'Action failed'); }
}

export function initAdminQuotations(){
  const pane = document.getElementById('pane-quotations'); if(!pane) return;
  document.getElementById('adminQuoRefresh')?.addEventListener('click', ()=>{ aqState.page=1; loadAdminQuotations(); });
  document.getElementById('adminQuoStatusFilter')?.addEventListener('change', (e)=>{ aqState.status = e.target.value; aqState.page=1; loadAdminQuotations(); });
  document.getElementById('adminQuoUserFilter')?.addEventListener('change', (e)=>{ aqState.user_id = e.target.value.trim(); aqState.page=1; loadAdminQuotations(); });
  // Lazy initial load when tab first activated
  const tabBtn = document.getElementById('tab-quotations');
  if(tabBtn){
    tabBtn.addEventListener('shown.bs.tab', ()=>{ if(!aqState.__loaded){ aqState.__loaded=true; loadAdminQuotations(); } });
  }
}

export function updateAdminQuoBadge(){
  try {
    const badge = document.getElementById('adminQuoBadge'); if(!badge) return;
    const pending = (aqState.list||[]).filter(q=> q.status==='REQUESTED' || q.status==='REPLIED' || q.status==='FULFILLMENT_PENDING').length;
    if(pending>0){ badge.textContent=String(pending); badge.classList.remove('d-none'); } else { badge.classList.add('d-none'); }
  } catch(_){ }
}

// Auto-attach for debugging if loaded directly
if(typeof window !== 'undefined'){ window.__initAdminQuotations = initAdminQuotations; }
