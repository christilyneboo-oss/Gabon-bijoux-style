const WHATSAPP_NUMBER = "24107049872";

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('gabon_bijoux_current_user') || 'null');
  } catch (error) {
    return null;
  }
}

window.addEventListener('DOMContentLoaded', () => {
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

function getOrderItemsFromCart() {
  try {
    const cart = JSON.parse(localStorage.getItem('gabon_bijoux_cart') || '[]');
    if (Array.isArray(cart) && cart.length > 0) {
      return cart.map((item) => ({
        productId: Number(item.id || 0),
        quantity: Number(item.quantity || 1),
        price: Number(item.price || 0),
        name: String(item.name || 'Bijou')
      }));
    }
  } catch (error) {
    return [];
  }

  return [];
}

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
    const quantite = Number(document.getElementById('quantite').value || 1);
    const message = document.getElementById('message').value.trim();

    if (!nom || !telephone) {
      alert('Merci de remplir au moins le nom et le téléphone.');
      return;
    }

    const cartItems = getOrderItemsFromCart();
    if (!cartItems.length) {
      alert('Votre panier est vide. Sélectionnez au moins un bijou avant de commander.');
      window.location.href = 'panier.html';
      return;
    }

    const normalizedItems = cartItems.map((item) => ({
      productId: Number(item.productId || 0),
      quantity: Number(item.quantity || 1) * quantite,
      price: Number(item.price || 0)
    }));

    const invalidItem = normalizedItems.find((item) => !Number(item.productId));
    if (invalidItem) {
      alert('Une pièce du panier est invalide. Vérifiez votre sélection avant de continuer.');
      return;
    }

    try {
      const courier = getCourierConfig();
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          name: nom,
          telephone,
          city: ville,
          message,
          deliveryName: courier.name,
          deliveryPhone: courier.phone,
          items: normalizedItems
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'La commande n’a pas pu être enregistrée.');
      }

      const firstItemName = cartItems[0]?.name || 'Bijou';
      const totalItems = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalPrice = normalizedItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);

      let texte = 'Bonjour Gabon Bijoux Style, je souhaite confirmer ma commande :\n';
      texte += `— Commande : #${data.id}\n`;
      texte += `— Produit(s) : ${cartItems.map((item) => `${item.name} x ${item.quantity}`).join(' • ')}\n`;
      texte += `— Quantité totale : ${totalItems}\n`;
      texte += `— Nom : ${nom}\n`;
      texte += `— Téléphone : ${telephone}\n`;
      if (ville) texte += `— Ville : ${ville}\n`;
      if (totalPrice > 0) texte += `— Prix estimé : ${new Intl.NumberFormat('fr-FR').format(totalPrice)} FCFA\n`;
      if (message) texte += `— Message : ${message}\n`;
      texte += `— Facture : ${data.invoiceNumber || 'À générer'}\n`;

      const lienWhatsApp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texte)}`;
      const whatsappPopup = window.open(lienWhatsApp, '_blank', 'noopener,noreferrer');

      localStorage.removeItem('gabon_bijoux_cart');

      if (!whatsappPopup) {
        window.location.href = lienWhatsApp;
        return;
      }
      alert('Commande enregistrée. Vous pouvez suivre son statut dans votre compte.');
      window.location.href = 'compte.html';
    } catch (error) {
      alert(error.message);
    }
  });
}
