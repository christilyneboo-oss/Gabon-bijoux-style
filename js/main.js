const STORAGE_KEYS = {
  currentUser: 'gabon_bijoux_current_user'
};

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.currentUser) || 'null');
  } catch (error) {
    return null;
  }
}

function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
}

function formatPrice(value) {
  return new Intl.NumberFormat('fr-FR').format(value) + ' FCFA';
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || 'Une erreur est survenue.');
  }

  return data;
}

function renderProductCards() {
  const grid = document.querySelector('.grid, .shop-grid');
  if (!grid) return;

  fetchJson('/api/products')
    .then((products) => {
      grid.innerHTML = products.map((product) => `
        <article class="card reveal">
          <div class="card-media">
            <img src="${product.image || 'images/placeholder.svg'}" alt="${product.name}" onerror="this.src='images/placeholder.svg'">
          </div>
          <div class="card-body">
            <div class="card-code">RÉF. ${String(product.id).toUpperCase()} — ${String(product.category).toUpperCase()}</div>
            <div class="card-name">${product.name}</div>
            <div class="card-price">${formatPrice(product.price)}</div>
            <p class="card-description">${product.description || 'Bijou premium pour tous les jours.'}</p>
            <a href="commander.html?produit=${encodeURIComponent(product.name)}&prix=${product.price}" class="card-cta">Commander →</a>
          </div>
        </article>
      `).join('');

      if (window.IntersectionObserver) {
        const io = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) entry.target.classList.add('in-view');
          });
        }, { threshold: 0.2 });

        document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
      } else {
        document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in-view'));
      }
    })
    .catch((error) => {
      grid.innerHTML = `<p class="card-description">${error.message}</p>`;
    });
}

function bindAuthForms() {
  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout-btn');
  const accountPanel = document.querySelector('.account-panel');
  const user = getCurrentUser();

  if (accountPanel) {
    const title = accountPanel.querySelector('.account-status');
    const profile = accountPanel.querySelector('.user-profile');
    if (user) {
      title.textContent = user.role === 'admin' ? 'Administrateur connecté' : 'Compte client actif';
      profile.innerHTML = `
        <p><strong>Nom :</strong> ${user.name}</p>
        <p><strong>Email :</strong> ${user.email}</p>
        <p><strong>Rôle :</strong> ${user.role === 'admin' ? 'Admin' : 'Client'}</p>
      `;
    } else {
      title.textContent = 'Aucun compte actif';
      profile.innerHTML = '<p>Créez un compte ou connectez-vous pour commander.</p>';
    }
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        name: document.getElementById('register-name').value.trim(),
        email: document.getElementById('register-email').value.trim(),
        password: document.getElementById('register-password').value
      };

      if (!payload.name || !payload.email || !payload.password) {
        alert('Merci de remplir tous les champs.');
        return;
      }

      try {
        const userData = await fetchJson('/api/register', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setCurrentUser(userData);
        alert('Compte créé avec succès.');
        window.location.reload();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        email: document.getElementById('login-email').value.trim(),
        password: document.getElementById('login-password').value
      };

      try {
        const userData = await fetchJson('/api/login', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setCurrentUser(userData);
        alert('Connexion réussie.');
        window.location.reload();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      setCurrentUser(null);
      alert('Déconnexion réussie.');
      window.location.reload();
    });
  }
}

function bindAdminPanel() {
  const adminShell = document.getElementById('admin-shell');
  if (!adminShell) return;

  const currentUser = getCurrentUser();
  const adminMessage = document.getElementById('admin-message');
  const adminForm = document.getElementById('admin-product-form');
  const newProductBtn = document.getElementById('admin-new-product-btn');
  const productList = document.getElementById('admin-product-list');
  const orderList = document.getElementById('admin-order-list');
  const imageInputFile = document.getElementById('product-image-file');
  const imageInputHidden = document.getElementById('product-image');
  const imagePreview = document.getElementById('product-image-preview');

  function updateImagePreview(imageValue) {
    if (!imagePreview) return;
    const nextValue = imageValue || 'images/placeholder.svg';
    imagePreview.src = nextValue;
    imagePreview.onerror = () => {
      imagePreview.src = 'images/placeholder.svg';
    };
    if (imageInputHidden) imageInputHidden.value = nextValue;
  }

  if (imageInputFile) {
    imageInputFile.addEventListener('change', async (event) => {
      const [file] = event.target.files || [];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        updateImagePreview(String(reader.result || 'images/placeholder.svg'));
      };
      reader.readAsDataURL(file);
    });
  }

  if (!currentUser || currentUser.role !== 'admin') {
    if (adminMessage) adminMessage.textContent = 'Accès refusé. Connectez-vous avec un compte administrateur.';
    if (adminForm) adminForm.style.display = 'none';
    return;
  }

  if (adminMessage) adminMessage.textContent = `Bienvenue, ${currentUser.name} !`;

  function renderAdminList(products) {
    if (!productList) return;
    productList.innerHTML = products.map((product) => `
      <div class="admin-item">
        <div>
          <strong>${product.name}</strong>
          <p>${product.category} • ${formatPrice(product.price)} • Stock : ${Number(product.stock || 0)}</p>
        </div>
        <div class="admin-actions">
          <button type="button" data-edit="${product.id}" class="btn btn-small btn-primary">Modifier</button>
          <button type="button" data-delete="${product.id}" class="btn btn-small btn-ghost dark">Supprimer</button>
        </div>
      </div>
    `).join('') || '<p>Aucun bijou enregistré pour le moment.</p>';

    productList.querySelectorAll('[data-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await fetchJson(`/api/products/${button.dataset.delete}`, { method: 'DELETE' });
          const products = await fetchJson('/api/products');
          renderAdminList(products);
          renderProductCards();
        } catch (error) {
          alert(error.message);
        }
      });
    });

    productList.querySelectorAll('[data-edit]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          const products = await fetchJson('/api/products');
          const product = products.find((item) => String(item.id) === String(button.dataset.edit));
          if (!product) return;
          document.getElementById('product-id').value = product.id;
          document.getElementById('product-name').value = product.name;
          document.getElementById('product-category').value = product.category;
          document.getElementById('product-price').value = product.price;
          document.getElementById('product-stock').value = Number(product.stock || 0);
          document.getElementById('product-description').value = product.description;
          updateImagePreview(product.image || 'images/placeholder.svg');
          if (imageInputFile) imageInputFile.value = '';
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function renderOrderList(orders) {
    if (!orderList) return;

    if (!orders.length) {
      orderList.innerHTML = '<p>Aucune commande pour le moment.</p>';
      return;
    }

    const statusLabels = {
      pending: 'En attente',
      confirmed: 'Confirmée',
      shipped: 'Expédiée',
      delivered: 'Livrée'
    };

    orderList.innerHTML = orders.map((order) => {
      const items = (order.items || []).map((item) => `
        <li>${item.product_name || 'Produit'} × ${item.quantity} — ${formatPrice(item.price * item.quantity)}</li>
      `).join('');

      const nextStatus = order.status === 'pending' ? 'confirmed' : order.status === 'confirmed' ? 'shipped' : order.status === 'shipped' ? 'delivered' : 'pending';
      const nextLabel = order.status === 'pending' ? 'Valider' : order.status === 'confirmed' ? 'Expédier' : order.status === 'shipped' ? 'Livrer' : 'Rouvrir';

      return `
        <div class="admin-item">
          <div>
            <strong>Commande #${order.id}</strong>
            <p>${order.customer_name || 'Client'} • ${order.customer_phone || 'Sans téléphone'}</p>
            <p>${order.city || 'Ville non précisée'} • ${formatPrice(order.total)}</p>
            <p>Statut : ${statusLabels[order.status] || order.status}</p>
            <ul>${items || '<li>Produit unique</li>'}</ul>
          </div>
          <div class="admin-actions">
            <button type="button" data-order-status="${order.id}" data-next-status="${nextStatus}" class="btn btn-small btn-primary">${nextLabel}</button>
          </div>
        </div>
      `;
    }).join('');

    orderList.querySelectorAll('[data-order-status]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await fetchJson(`/api/orders/${button.dataset.orderStatus}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: button.dataset.nextStatus })
          });
          const orders = await fetchJson('/api/orders');
          renderOrderList(orders);
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  if (newProductBtn) {
    newProductBtn.addEventListener('click', () => {
      adminForm.reset();
      document.getElementById('product-id').value = '';
      updateImagePreview('images/placeholder.svg');
      if (imageInputFile) imageInputFile.value = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (adminForm) {
    fetchJson('/api/products')
      .then(renderAdminList)
      .catch((error) => {
        if (productList) productList.innerHTML = `<p>${error.message}</p>`;
      });

    adminForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const id = document.getElementById('product-id').value;
      const payload = {
        name: document.getElementById('product-name').value.trim(),
        category: document.getElementById('product-category').value.trim(),
        price: Number(document.getElementById('product-price').value),
        stock: Number(document.getElementById('product-stock').value || 0),
        description: document.getElementById('product-description').value.trim(),
        image: document.getElementById('product-image').value.trim() || 'images/placeholder.svg'
      };

      if (!payload.name || !payload.category || !payload.price) {
        alert('Le nom, la catégorie et le prix sont obligatoires.');
        return;
      }

      try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/products/${id}` : '/api/products';
        await fetchJson(url, {
          method,
          body: JSON.stringify(payload)
        });
        adminForm.reset();
        document.getElementById('product-id').value = '';
        updateImagePreview('images/placeholder.svg');
        if (imageInputFile) imageInputFile.value = '';
        const products = await fetchJson('/api/products');
        renderAdminList(products);
        renderProductCards();
        alert('Bijou enregistré avec succès.');
      } catch (error) {
        alert(error.message);
      }
    });
  }

  updateImagePreview(imageInputHidden ? imageInputHidden.value : 'images/placeholder.svg');

  fetchJson('/api/orders')
    .then(renderOrderList)
    .catch((error) => {
      if (orderList) orderList.innerHTML = `<p>${error.message}</p>`;
    });
}

function setupAdminMenuLink() {
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== 'admin') return;

  document.querySelectorAll('.menu-panel').forEach((panel) => {
    if (panel.querySelector('[data-role="admin-nav"]')) return;

    const adminLink = document.createElement('a');
    adminLink.href = 'admin.html';
    adminLink.dataset.role = 'admin-nav';
    adminLink.textContent = 'Gestion boutique';
    panel.appendChild(adminLink);
  });
}

function setupBurgerMenu() {
  const burger = document.querySelector('.menu-btn');
  const menuPanel = document.querySelector('.menu-panel');
  if (burger && menuPanel) {
    burger.addEventListener('click', () => {
      menuPanel.classList.toggle('open');
    });

    menuPanel.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => menuPanel.classList.remove('open'));
    });
  }
}

function setupObserver() {
  const items = document.querySelectorAll('.reveal, .facet-divider');
  if (!items.length) return;

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('in-view');
      });
    }, { threshold: 0.2 });

    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add('in-view'));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderProductCards();
  bindAuthForms();
  bindAdminPanel();
  setupAdminMenuLink();
  setupBurgerMenu();
  setupObserver();
});
