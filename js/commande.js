const WHATSAPP_NUMBER = "24107049872";

async function loadProductsIntoSelect() {
  const produitSelect = document.getElementById('produit');
  if (!produitSelect) return;

  try {
    const products = await fetch('/api/products').then((response) => response.json());
    produitSelect.innerHTML = '<option value="">— Choisir un produit —</option>';

    products.forEach((product) => {
      const option = document.createElement('option');
      option.value = String(product.id);
      option.dataset.name = product.name;
      option.dataset.price = String(product.price);
      option.textContent = `${product.name} — ${new Intl.NumberFormat('fr-FR').format(product.price)} FCFA`;
      produitSelect.appendChild(option);
    });

    const params = new URLSearchParams(window.location.search);
    const produit = params.get('produit');
    const prix = params.get('prix');
    if (produit) {
      let found = false;
      for (const option of produitSelect.options) {
        if (option.dataset.name === produit || option.value === produit) {
          option.selected = true;
          found = true;
        }
      }

      if (!found) {
        const opt = document.createElement('option');
        opt.value = 'custom';
        opt.dataset.name = produit;
        opt.dataset.price = prix || '0';
        opt.textContent = prix ? `${produit} — ${new Intl.NumberFormat('fr-FR').format(Number(prix))} FCFA` : produit;
        opt.selected = true;
        produitSelect.appendChild(opt);
      }
    }
  } catch (error) {
    console.error('Erreur chargement produits:', error);
  }
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('gabon_bijoux_current_user') || 'null');
  } catch (error) {
    return null;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadProductsIntoSelect();

  const currentUser = getCurrentUser();
  const form = document.getElementById('order-form');
  const nom = document.getElementById('nom');

  if (currentUser && nom && currentUser.name) {
    nom.value = currentUser.name;
  }

  if (form && !currentUser) {
    alert('Vous devez créer un compte et vous connecter pour passer une commande.');
    window.location.href = 'compte.html';
  }
});

const form = document.getElementById('order-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentUser = getCurrentUser();
    if (!currentUser) {
      alert('Vous devez créer un compte et vous connecter pour passer une commande.');
      window.location.href = 'compte.html';
      return;
    }

    const nom = document.getElementById('nom').value.trim();
    const telephone = document.getElementById('telephone').value.trim();
    const ville = document.getElementById('ville').value.trim();
    const produitSelect = document.getElementById('produit');
    const quantite = Number(document.getElementById('quantite').value || 1);
    const message = document.getElementById('message').value.trim();

    if (!nom || !telephone) {
      alert('Merci de remplir au moins le nom et le téléphone.');
      return;
    }

    const selectedProduct = produitSelect && produitSelect.selectedOptions[0];
    const productId = Number(selectedProduct?.value || 0);
    const productName = selectedProduct && selectedProduct.dataset.name
      ? selectedProduct.dataset.name
      : 'Produit à confirmer';
    const productPrice = Number(selectedProduct?.dataset.price || 0);

    if (!productId) {
      alert('Veuillez sélectionner un produit avant de passer commande.');
      return;
    }

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          name: nom,
          telephone,
          city: ville,
          message,
          deliveryName: 'Livreur GBS',
          deliveryPhone: '+241 06 00 00 00',
          items: [{
            productId,
            quantity: quantite,
            price: productPrice
          }]
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'La commande n’a pas pu être enregistrée.');
      }

      let texte = 'Bonjour Gabon Bijoux Style, je souhaite confirmer ma commande :\n';
      texte += `— Commande : #${data.id}\n`;
      texte += `— Produit : ${productName}\n`;
      texte += `— Quantité : ${quantite}\n`;
      texte += `— Nom : ${nom}\n`;
      texte += `— Téléphone : ${telephone}\n`;
      if (ville) texte += `— Ville : ${ville}\n`;
      if (productPrice > 0) texte += `— Prix estimé : ${new Intl.NumberFormat('fr-FR').format(productPrice)} FCFA\n`;
      if (message) texte += `— Message : ${message}\n`;
      texte += `— Facture : ${data.invoiceNumber || 'À générer'}\n`;

      const lienWhatsApp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texte)}`;
      window.open(lienWhatsApp, '_blank');
      alert('Commande enregistrée. Vous pouvez suivre son statut dans votre compte.');
      window.location.href = 'compte.html';
    } catch (error) {
      alert(error.message);
    }
  });
}
