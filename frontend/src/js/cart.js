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

document.getElementById('checkoutBtn').addEventListener('click', () => {
  alert('Checkout coming soon.');
});
