import { API_BASE } from './config.js';

function cart_get(){ try { return JSON.parse(localStorage.getItem('cart')||'[]'); } catch(_) { return []; } }
function cart_set(items){ localStorage.setItem('cart', JSON.stringify(items)); window.dispatchEvent(new CustomEvent('cart:changed', { detail:{ items } })); }
function cart_total(items){ return items.reduce((s,i)=>s + Number(i.price)*Number(i.qty), 0); }

function render(){
  const wrap = document.getElementById('cartTableWrap');
  const items = cart_get();
  if (!items.length) { wrap.innerHTML = '<div class="alert alert-info">Your cart is empty.</div>'; return; }
  const rows = items.map((i,idx)=>`
    <tr>
      <td>${i.title}</td>
      <td>$${Number(i.price).toFixed(2)}</td>
      <td style="width:120px"><input type="number" class="form-control form-control-sm" min="1" value="${i.qty}" data-idx="${idx}"/></td>
      <td>$${(Number(i.price)*Number(i.qty)).toFixed(2)}</td>
      <td><button class="btn btn-sm btn-outline-danger" data-rm="${idx}">Remove</button></td>
    </tr>`).join('');
  wrap.innerHTML = `
    <table class="table align-middle">
      <thead><tr><th>Product</th><th>Unit Price</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th colspan="3" class="text-end">Total</th><th>$${cart_total(items).toFixed(2)}</th><th></th></tr></tfoot>
    </table>`;
  wrap.querySelectorAll('input[type=number]').forEach(inp => {
    inp.addEventListener('change', () => { const idx = Number(inp.dataset.idx); items[idx].qty = Math.max(1, Number(inp.value)); cart_set(items); render(); });
  });
  wrap.querySelectorAll('[data-rm]').forEach(btn => {
    btn.addEventListener('click', () => { const idx = Number(btn.dataset.rm); items.splice(idx,1); cart_set(items); render(); });
  });
}

render();

async function apiRequestQuotation(){
  const token = localStorage.getItem('token');
  if(!token){ window.location.href='/?#signin&redirect=/cart'; return; }
  const items = cart_get();
  if(!items.length){ alert('Cart empty'); return; }
  // Map cart items to API shape (product_id, quantity)
  const payloadItems = items.map(i=> ({ product_id: i.id || i.product_id, quantity: i.qty }));
  // Remove any invalid
  if(payloadItems.some(i=> !i.product_id)){ alert('Missing product id in cart item'); return; }
  const btn = document.getElementById('checkoutBtn');
  btn.disabled = true; const orig = btn.textContent; btn.textContent='Requesting...';
  try {
    const res = await fetch(`${API_BASE.replace('/api', '')}/api/quotations`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization: 'Bearer '+token },
      body: JSON.stringify({ items: payloadItems })
    });
    if(!res.ok) throw new Error(await res.text());
    const q = await res.json();
    // Clear cart after successful quotation request
    cart_set([]);
    if(window.showToast) showToast('Quotation requested: '+ q.reference, { type:'success' });
    // Redirect to quotations pane in dashboard (we will implement the page soon)
    window.location.href='/dashboard?pane=quotations';
  } catch(e){
    if(window.showToast) showToast(e.message || 'Failed', { type:'error' }); else alert(e.message||'Failed');
  } finally {
    btn.disabled=false; btn.textContent=orig;
  }
}

document.getElementById('checkoutBtn').addEventListener('click', apiRequestQuotation);
