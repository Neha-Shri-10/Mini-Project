let selectedProduct = "";

function startPayment(event, productName) {
  event.stopPropagation(); // prevent card toggle
  selectedProduct = productName;
  document.getElementById('modalTitle').textContent = `Confirm Purchase: ${productName}`;
  document.getElementById('paymentModal').style.display = 'block';
}

function confirmPayment() {
  const method = document.getElementById('paymentMethod').value;
  alert(`Payment for "${selectedProduct}" successful via ${method}.`);
  document.getElementById('paymentModal').style.display = 'none';
}

function cancelPayment() {
  alert(`Payment for "${selectedProduct}" has been canceled.`);
  document.getElementById('paymentModal').style.display = 'none';
}
