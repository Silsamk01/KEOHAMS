// Quotations frontend module
// Handles listing, detail view, payment initiation for user quotations
// Relies on token-based auth already handled globally

const Q_API = 'http://localhost:4000/api/quotations';

function qAuthHeaders(){
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {}; }

async function qFetchJSON(url, opts={}){
  const res = await fetch(url, { ...opts, headers: { 'Accept':'application/json', ...(opts.headers||{}), ...qAuthHeaders() } });
  if(!res.ok) throw new Error((await res.text())||`HTTP ${res.status}`); return res.json(); }

let qState = {
  list: [],
  page: 1,
  pageSize: 25,
  total: 0,
  selectedId: null,
  filterStatus: ''
};

function qFormatMoney(v){ if(v==null) return '—'; return Number(v).toLocaleString(undefined,{ style:'currency', currency:'USD', minimumFractionDigits:2 }); }
function qFormatDate(d){ try { return new Date(d).toLocaleString(); } catch(_) { return d||'—'; } }
function qStatusColor(s){ return ({ REQUESTED:'secondary', REPLIED:'warning', FULFILLMENT_PENDING:'info', PAID:'success', CANCELLED:'dark' })[s]||'secondary'; }

export async function loadQuotations(force=false){
  const listEl = document.getElementById('quoList'); if(!listEl) return;
  listEl.innerHTML = '<div class="p-3 small text-muted">Loading…</div>';
  try {
    const params = new URLSearchParams({ page:String(qState.page), pageSize:String(qState.pageSize) });
    if(qState.filterStatus) params.set('status', qState.filterStatus);
    const data = await qFetchJSON(`${Q_API}/mine?${params.toString()}`);
    qState.list = data.data || [];
    qState.total = data.total || qState.list.length;
    renderQuotationList();
  } catch(e){ listEl.innerHTML = `<div class="p-3 small text-danger">${e.message||'Failed to load'}</div>`; }
}

function renderQuotationList(){
  const listEl = document.getElementById('quoList'); if(!listEl) return;
  listEl.innerHTML='';
  if(!qState.list.length){ listEl.innerHTML = '<div class="p-3 text-muted small">No quotations yet.</div>'; renderQuotationDetail(null); return; }
  const badge = document.getElementById('quoCountBadge'); if(badge){ badge.textContent=String(qState.total); badge.classList.remove('d-none'); }
  qState.list.forEach(q=>{
    const btn = document.createElement('button');
    btn.type='button';
    btn.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-start';
    btn.innerHTML = `
      <div class="me-2">
        <div class="fw-semibold">${q.reference}</div>
        <div class="small text-muted">${qStatusShort(q.status)} · ${q.items_count||q.items?.length||0} items</div>
      </div>
      <span class="badge rounded-pill text-bg-${qStatusColor(q.status)}">${q.status}</span>`;
    btn.addEventListener('click', ()=> selectQuotation(q.id));
    if(q.id === qState.selectedId) btn.classList.add('active');
    listEl.appendChild(btn);
  });
  // Auto select first if none selected
  if(!qState.selectedId && qState.list.length){ selectQuotation(qState.list[0].id); }
}

function qStatusShort(s){ return s==='REQUESTED'?'Pending': (s==='REPLIED'?'Reply Ready': s==='PAID'?'Paid': s==='CANCELLED'?'Cancelled': s); }

async function selectQuotation(id){
  qState.selectedId = id;
  const detailEl = document.getElementById('quoDetailBody'); if(detailEl) detailEl.innerHTML = '<div class="p-3 small text-muted">Loading…</div>';
  try {
    const q = await qFetchJSON(`${Q_API}/mine/${id}`);
    renderQuotationDetail(q);
    // Highlight selection
    document.querySelectorAll('#quoList .list-group-item').forEach(li=> li.classList.remove('active'));
    const match = Array.from(document.querySelectorAll('#quoList .list-group-item')).find(li=> li.textContent.includes(q.reference));
    if(match) match.classList.add('active');
  } catch(e){ if(detailEl) detailEl.innerHTML = `<div class="text-danger small p-3">${e.message||'Failed to load detail'}</div>`; }
}

function renderQuotationDetail(q){
  const titleEl = document.getElementById('quoDetailTitle');
  const bodyEl = document.getElementById('quoDetailBody');
  const actionsEl = document.getElementById('quoDetailActions');
  const statusBadge = document.getElementById('quoStatusBadge');
  const metaFooter = document.getElementById('quoMetaFooter');
  const metaCreated = document.getElementById('quoMetaCreated');
  const metaTotals = document.getElementById('quoMetaTotals');
  const payWrap = document.getElementById('quoPaymentDropdownWrap');
  const payMenu = document.getElementById('quoPaymentMenu');
  if(!bodyEl) return;
  if(!q){
    titleEl.textContent='Select a quotation';
    bodyEl.innerHTML='<div class="text-muted small">Choose a request on the left to view details.</div>';
    actionsEl.style.display='none'; metaFooter.style.display='none'; return;
  }
  titleEl.textContent = q.reference;
  statusBadge.textContent = q.status;
  statusBadge.className = `badge rounded-pill text-bg-${qStatusColor(q.status)}`;
  actionsEl.style.display='flex';
  metaFooter.style.display='flex';
  metaCreated.textContent = 'Created ' + qFormatDate(q.created_at);
  const sum = qTotalSummary(q);
  metaTotals.textContent = sum;
  bodyEl.innerHTML = `
    <div class="mb-3">
      <div class="small text-muted mb-1">Items</div>
      <div class="table-responsive small">
        <table class="table table-sm align-middle mb-0">
          <thead><tr><th>Product</th><th class="text-end">Qty</th><th class="text-end">Unit</th><th class="text-end">Line</th></tr></thead>
          <tbody>
            ${(q.items||[]).map(i=> `<tr><td>${escapeHtml(i.product_name)}</td><td class="text-end">${i.quantity}</td><td class="text-end">${qFormatMoney(i.unit_price)}</td><td class="text-end">${qFormatMoney(i.line_total)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ${(q.items||[]).some(it=> Number(it.unit_price)===0) ? '<div class="alert alert-warning py-2 small">One or more items had no price at request time; please contact support if unexpected.</div>' : ''}
    <div class="row g-3 small">
      <div class="col-md-6">
        <div class="fw-semibold mb-1">User Notes</div>
        <div class="border rounded p-2" style="min-height:54px;">${escapeHtml(q.notes_user||'—')}</div>
      </div>
      <div class="col-md-6">
        <div class="fw-semibold mb-1">Admin Notes</div>
        <div class="border rounded p-2" style="min-height:54px;">${escapeHtml(q.notes_admin||'—')}</div>
      </div>
    </div>
    <div class="mt-3 small text-muted">Last updated ${qFormatDate(q.updated_at)}</div>
  `;
  // Payment
  if(q.status === 'REPLIED'){
    const allowed = (q.allowed_payment_methods||'').split(',').filter(Boolean);
    if(allowed.length){
      payWrap.style.display='block';
      payMenu.innerHTML = '';
      allowed.forEach(m=>{
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className='dropdown-item';
        a.href='#';
        a.textContent = 'Pay with ' + m.charAt(0).toUpperCase()+m.slice(1);
        a.addEventListener('click', (e)=>{ e.preventDefault(); initiatePayment(q.id, m); });
        li.appendChild(a); payMenu.appendChild(li);
      });
    } else { payWrap.style.display='none'; }
  } else {
    payWrap.style.display='none';
  }
}

function qTotalSummary(q){
  const base = Number(q.subtotal_amount)||0;
  const logistics = Number(q.logistics_amount)||0;
  const discount = Number(q.discount_amount)||0;
  const total = Number(q.total_amount)|| base + logistics - discount;
  return `Subtotal ${qFormatMoney(base)}  ·  Logistics ${qFormatMoney(logistics)}  ·  Discount ${qFormatMoney(discount)}  =  Total ${qFormatMoney(total)}`;
}

async function initiatePayment(id, method){
  const detailEl = document.getElementById('quoDetailBody');
  try {
    const resp = await qFetchJSON(`${Q_API}/mine/${id}/pay`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ method }) });
    const payload = resp.payload;
    if (payload.provider === 'paystack' && payload.authorization_url) {
      // Redirect to Paystack payment page
      window.location.href = payload.authorization_url;
    } else {
      // For other methods, show payload
      const pre = escapeHtml(JSON.stringify(payload, null, 2));
      const box = document.createElement('div');
      box.className='alert alert-info mt-3';
      box.innerHTML = `<strong>Payment Initiated:</strong><pre class="small mt-2 mb-0" style="white-space:pre-wrap;">${pre}</pre>`;
      detailEl.appendChild(box);
    }
  } catch(e){
    alert(e.message||'Payment init failed');
  }
}

function escapeHtml(s){ return (s==null?'':String(s)).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c])); }

export function initQuotationsUI(){
  const pane = document.getElementById('pane-quotations'); if(!pane) return;
  // Wire events
  document.getElementById('quoRefreshBtn')?.addEventListener('click', ()=> loadQuotations(true));
  document.getElementById('quoStatusFilter')?.addEventListener('change', (e)=>{ qState.filterStatus = e.target.value; loadQuotations(true); });
  // Lazy load when pane first shown
  const obs = new MutationObserver(()=>{
    if(!pane.classList.contains('d-none')) { loadQuotations(); obs.disconnect(); }
  });
  obs.observe(pane, { attributes:true, attributeFilter:['class'] });
}

// Auto-init if script loaded after DOM (non-module inclusion scenario)
if (typeof window !== 'undefined') {
  window.initQuotationsUI = initQuotationsUI;
}
