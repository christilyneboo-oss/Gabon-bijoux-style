const STORAGE_KEYS = {
  currentUser: 'gabon_bijoux_current_user',
  deliveryConfig: 'gabon_bijoux_delivery_config'
};

const DEFAULT_DELIVERY = {
  name: 'Igor',
  phone: '+241 02-40-91-88'
};

function getCourierConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.deliveryConfig) || 'null');
    return {
      name: saved?.name || DEFAULT_DELIVERY.name,
      phone: saved?.phone || DEFAULT_DELIVERY.phone
    };
  } catch (error) {
    return { ...DEFAULT_DELIVERY };
  }
}

function saveCourierConfig(config) {
  const nextConfig = {
    name: String(config?.name || DEFAULT_DELIVERY.name).trim() || DEFAULT_DELIVERY.name,
    phone: String(config?.phone || DEFAULT_DELIVERY.phone).trim() || DEFAULT_DELIVERY.phone
  };
  localStorage.setItem(STORAGE_KEYS.deliveryConfig, JSON.stringify(nextConfig));
  return nextConfig;
}

let currentCatalogFilter = 'Tous';
let currentCatalogSearch = '';

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

function formatDateTime(value) {
  if (!value) return 'Date inconnue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function getDeliveryInfo(order) {
  const courier = getCourierConfig();
  const name = order?.delivery_name || courier.name;
  const phone = order?.delivery_phone || courier.phone;
  return { name, phone };
}

function buildCourierLink(phone) {
  const cleanPhone = String(phone || '').replace(/\s+/g, '').replace(/[^+\d]/g, '');
  if (!cleanPhone) return '#';
  return `tel:${cleanPhone}`;
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

const SHOP_CATEGORY_ORDER = ['Ensembles', 'Bracelets', 'Boucles', 'Bagues', 'Colliers', 'Chevillères'];

function normalizeCategory(category) {
  const raw = String(category || '').trim();
  if (!raw) return 'Autres';

  const aliases = {
    ensemble: 'Ensembles',
    ensembles: 'Ensembles',
    bracelet: 'Bracelets',
    bracelets: 'Bracelets',
    boucle: 'Boucles',
    boucles: 'Boucles',
    bague: 'Bagues',
    bagues: 'Bagues',
    collier: 'Colliers',
    colliers: 'Colliers',
    chevillere: 'Chevillères',
    chevilleres: 'Chevillères',
    'chevillères': 'Chevillères'
  };

  const normalized = raw.toLowerCase();
  if (aliases[normalized]) return aliases[normalized];

  const titleCase = raw
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return titleCase;
}

function applyCatalogFilters() {
  const catalogSections = document.querySelectorAll('.catalog-section');
  const query = currentCatalogSearch.trim().toLowerCase();
  let visibleSectionCount = 0;

  catalogSections.forEach((section) => {
    const sectionTitle = (section.dataset.categorySection || '').toLowerCase();
    const cards = [...section.querySelectorAll('.card')];
    let visibleCards = 0;

    cards.forEach((card) => {
      const text = (card.textContent || '').toLowerCase();
      const categoryMatch = currentCatalogFilter === 'Tous' || sectionTitle === currentCatalogFilter.toLowerCase();
      const searchMatch = !query || text.includes(query);
      const shouldShow = categoryMatch && searchMatch;
      card.style.display = shouldShow ? '' : 'none';
      if (shouldShow) visibleCards += 1;
    });

    const isVisible = visibleCards > 0;
    section.style.display = isVisible ? '' : 'none';
    if (isVisible) visibleSectionCount += 1;
  });

  const emptyState = document.getElementById('catalog-empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  if (!visibleSectionCount && query) {
    const container = document.getElementById('catalog-sections');
    if (container) {
      const notice = document.createElement('div');
      notice.id = 'catalog-empty-state';
      notice.className = 'search-empty-state';
      notice.textContent = 'Aucun produit trouvé pour votre recherche.';
      container.appendChild(notice);
    }
  }

  const filterButtons = document.querySelectorAll('[data-category-filter]');
  filterButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.categoryFilter === currentCatalogFilter);
  });
}

function bindCatalogSearch() {
  const searchInput = document.getElementById('catalog-search');
  const searchButton = document.querySelector('.icon-search');

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      currentCatalogSearch = event.target.value || '';
      applyCatalogFilters();
    });
  }

  if (searchButton) {
    searchButton.addEventListener('click', () => {
      const target = document.getElementById('catalog-search');
      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }
}

function bindExpandableContent() {
  document.querySelectorAll('[data-toggle-target]').forEach((button) => {
    const targetId = button.dataset.toggleTarget;
    const target = document.getElementById(targetId);
    if (!target) return;

    const openLabel = button.dataset.openLabel || button.textContent || 'En savoir plus';
    const closeLabel = button.dataset.closeLabel || 'Fermer';

    button.addEventListener('click', () => {
      const isOpen = target.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(isOpen));
      target.setAttribute('aria-hidden', String(!isOpen));
      button.textContent = isOpen ? closeLabel : openLabel;
    });
  });
}

function renderProductCards() {
  const grid = document.querySelector('.grid, .shop-grid');
  const catalogSections = document.getElementById('catalog-sections');

  fetchJson('/api/products')
    .then((products) => {
      if (catalogSections) {
        const grouped = {};
        SHOP_CATEGORY_ORDER.forEach((category) => {
          grouped[category] = [];
        });

        products.forEach((product) => {
          const category = normalizeCategory(product.category);
          if (!grouped[category]) grouped[category] = [];
          grouped[category].push(product);
        });

        const sectionOrder = [...SHOP_CATEGORY_ORDER, ...Object.keys(grouped).filter((category) => !SHOP_CATEGORY_ORDER.includes(category)).sort()];
        catalogSections.innerHTML = sectionOrder.map((category) => {
          const items = grouped[category] || [];
          if (!items.length) return '';

          return `
            <section class="catalog-section" data-category-section="${category}">
              <div class="catalog-section-header">
                <div>
                  <span class="eyebrow">Collection</span>
                  <h3>${category}</h3>
                </div>
                <span class="catalog-count">${items.length} pièce${items.length > 1 ? 's' : ''}</span>
              </div>
              <div class="shop-grid">
                ${items.map((product) => `
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
                `).join('')}
              </div>
            </section>
          `;
        }).join('');

        const filterButtons = document.querySelectorAll('[data-category-filter]');
        filterButtons.forEach((button) => {
          button.addEventListener('click', () => {
            currentCatalogFilter = button.dataset.categoryFilter;
            applyCatalogFilters();
          });
        });

        applyCatalogFilters();

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

        return;
      }

      if (!grid) return;

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
      if (catalogSections) {
        catalogSections.innerHTML = `<p class="card-description">${error.message}</p>`;
        return;
      }
      if (grid) {
        grid.innerHTML = `<p class="card-description">${error.message}</p>`;
      }
    });
}

function getStatusLabel(status) {
  const labels = {
    preparation: 'Préparation de la commande',
    en_route: 'Livreur en route',
    livree: 'Livrée',
    pending: 'En attente',
    confirmed: 'Confirmée',
    shipped: 'Expédiée',
    delivered: 'Livrée'
  };
  return labels[status] || 'En cours';
}

function renderUserOrders(orders) {
  const container = document.getElementById('user-orders-list');
  if (!container) return;

  if (!orders.length) {
    container.innerHTML = '<p>Aucune commande pour le moment.</p>';
    return;
  }

  const statusOrder = ['preparation', 'en_route', 'livree'];

  container.innerHTML = orders.map((order) => {
    const status = order.status || 'preparation';
    const currentIndex = statusOrder.includes(status) ? statusOrder.indexOf(status) : 0;
    const items = (order.items || []).map((item) => `
      <li>${item.product_name || 'Produit'} × ${item.quantity} — ${formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</li>
    `).join('');

    return `
      <div class="admin-item order-tracking-card">
        <div class="order-tracking-content">
          <div class="order-topline">
            <strong>Commande #${order.id}</strong>
            <span class="invoice-badge">${order.invoice_number || 'Facture en cours'}</span>
          </div>
          <p><strong>Passée le :</strong> ${formatDateTime(order.created_at)}</p>
          <p><strong>Livreur :</strong> ${getDeliveryInfo(order).name} • <a href="${buildCourierLink(getDeliveryInfo(order).phone)}">${getDeliveryInfo(order).phone}</a></p>
          <p>${getStatusLabel(status)}</p>
          <div class="tracking-steps">
            ${statusOrder.map((step, index) => `
              <div class="tracking-step ${index <= currentIndex ? 'is-active' : ''}">
                <span>${index + 1}</span>
                <small>${step === 'preparation' ? 'Préparation' : step === 'en_route' ? 'En route' : 'Livrée'}</small>
              </div>
            `).join('')}
          </div>
          <div class="invoice-box">
            <h4>Facture</h4>
            <ul>${items || '<li>Produit unique</li>'}</ul>
            <p><strong>Total :</strong> ${formatPrice(Number(order.total || 0))}</p>
            <p><strong>Livraison :</strong> ${order.city || 'Ville non précisée'}</p>
            <p><strong>Suivi :</strong> <a href="suivi.html?id=${order.id}">Voir le suivi complet</a></p>
          </div>

          <div class="rating-box">
            <div class="rating-row">
              <label>Note livreur</label>
              <select data-rating-delivery="${order.id}">
                <option value="">—</option>
                <option value="1" ${Number(order.delivery_rating || 0) === 1 ? 'selected' : ''}>1/5</option>
                <option value="2" ${Number(order.delivery_rating || 0) === 2 ? 'selected' : ''}>2/5</option>
                <option value="3" ${Number(order.delivery_rating || 0) === 3 ? 'selected' : ''}>3/5</option>
                <option value="4" ${Number(order.delivery_rating || 0) === 4 ? 'selected' : ''}>4/5</option>
                <option value="5" ${Number(order.delivery_rating || 0) === 5 ? 'selected' : ''}>5/5</option>
              </select>
            </div>
            <div class="rating-row">
              <label>Note boutique</label>
              <select data-rating-shop="${order.id}">
                <option value="">—</option>
                <option value="1" ${Number(order.shop_rating || 0) === 1 ? 'selected' : ''}>1/5</option>
                <option value="2" ${Number(order.shop_rating || 0) === 2 ? 'selected' : ''}>2/5</option>
                <option value="3" ${Number(order.shop_rating || 0) === 3 ? 'selected' : ''}>3/5</option>
                <option value="4" ${Number(order.shop_rating || 0) === 4 ? 'selected' : ''}>4/5</option>
                <option value="5" ${Number(order.shop_rating || 0) === 5 ? 'selected' : ''}>5/5</option>
              </select>
            </div>
            <textarea data-review-delivery="${order.id}" rows="2" placeholder="Commentaire livreur">${order.delivery_review || ''}</textarea>
            <textarea data-review-shop="${order.id}" rows="2" placeholder="Commentaire boutique">${order.shop_review || ''}</textarea>
            <button type="button" class="btn btn-small btn-primary" data-order-rate="${order.id}">Enregistrer avis</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-order-rate]').forEach((button) => {
    button.addEventListener('click', async () => {
      const orderId = button.dataset.orderRate;
      const payload = {
        delivery_rating: document.querySelector(`[data-rating-delivery="${orderId}"]`)?.value || null,
        shop_rating: document.querySelector(`[data-rating-shop="${orderId}"]`)?.value || null,
        delivery_review: document.querySelector(`[data-review-delivery="${orderId}"]`)?.value || '',
        shop_review: document.querySelector(`[data-review-shop="${orderId}"]`)?.value || ''
      };

      try {
        await fetchJson(`/api/orders/${orderId}/rating`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        const currentUser = getCurrentUser();
        if (currentUser) {
          const orders = await fetchJson(`/api/orders/user/${currentUser.id}`);
          renderUserOrders(orders);
        }
        alert('Votre avis a bien été enregistré.');
      } catch (error) {
        alert(error.message);
      }
    });
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

  const currentUser = getCurrentUser();
  if (currentUser && document.getElementById('user-orders-list')) {
    fetchJson(`/api/orders/user/${currentUser.id}`)
      .then(renderUserOrders)
      .catch((error) => {
        document.getElementById('user-orders-list').innerHTML = `<p>${error.message}</p>`;
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
  const deliveryForm = document.getElementById('admin-delivery-form');
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

  if (deliveryForm) {
    const deliveryNameInput = document.getElementById('delivery-name');
    const deliveryPhoneInput = document.getElementById('delivery-phone');
    const currentCourier = getCourierConfig();
    if (deliveryNameInput) deliveryNameInput.value = currentCourier.name;
    if (deliveryPhoneInput) deliveryPhoneInput.value = currentCourier.phone;

    deliveryForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nextCourier = saveCourierConfig({
        name: document.getElementById('delivery-name')?.value || DEFAULT_DELIVERY.name,
        phone: document.getElementById('delivery-phone')?.value || DEFAULT_DELIVERY.phone
      });
      if (deliveryNameInput) deliveryNameInput.value = nextCourier.name;
      if (deliveryPhoneInput) deliveryPhoneInput.value = nextCourier.phone;
      alert(`Livreur enregistré : ${nextCourier.name} • ${nextCourier.phone}`);

      try {
        const orders = await fetchJson('/api/orders');
        renderOrderList(orders);
      } catch (error) {
        alert(error.message);
      }
    });
  }

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
      preparation: 'Préparation de la commande',
      en_route: 'Livreur en route',
      livree: 'Livrée',
      pending: 'En attente',
      confirmed: 'Confirmée',
      shipped: 'Expédiée',
      delivered: 'Livrée'
    };

    orderList.innerHTML = orders.map((order) => {
      const items = (order.items || []).map((item) => `
        <li>${item.product_name || 'Produit'} × ${item.quantity} — ${formatPrice(item.price * item.quantity)}</li>
      `).join('');

      const orderStatus = order.status || 'preparation';
      const nextStatus = orderStatus === 'preparation' ? 'en_route' : orderStatus === 'en_route' ? 'livree' : orderStatus === 'pending' ? 'confirmed' : orderStatus === 'confirmed' ? 'shipped' : orderStatus === 'shipped' ? 'delivered' : 'preparation';
      const nextLabel = orderStatus === 'preparation' ? 'Mettre en route' : orderStatus === 'en_route' ? 'Marquer livrée' : orderStatus === 'pending' ? 'Valider' : orderStatus === 'confirmed' ? 'Expédier' : orderStatus === 'shipped' ? 'Livrer' : 'Terminer';

      return `
        <div class="admin-item">
          <div>
            <strong>Commande #${order.id}</strong>
            <p>${order.customer_name || 'Client'} • ${order.customer_phone || 'Sans téléphone'}</p>
            <p>Commande le : ${formatDateTime(order.created_at)}</p>
            <p>${order.city || 'Ville non précisée'} • ${formatPrice(order.total)}</p>
            <p>Livreur : ${getDeliveryInfo(order).name} • ${getDeliveryInfo(order).phone}</p>
            <p>Facture : ${order.invoice_number || 'À générer'}</p>
            <p>Statut : ${statusLabels[orderStatus] || orderStatus}</p>
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

function setupTrackingMenuLink() {
  const isAdminPage = window.location.pathname.endsWith('/admin.html') || window.location.pathname.endsWith('admin.html');
  if (isAdminPage) return;

  document.querySelectorAll('.menu-panel').forEach((panel) => {
    if (panel.querySelector('[data-role="tracking-nav"]')) return;

    const trackingLink = document.createElement('a');
    trackingLink.href = 'suivi.html';
    trackingLink.dataset.role = 'tracking-nav';
    trackingLink.textContent = 'Suivi commande';
    panel.appendChild(trackingLink);
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

function bindTrackingPage() {
  const trackingForm = document.getElementById('tracking-order-form');
  const trackingResult = document.getElementById('tracking-order-result');
  const trackingInput = document.getElementById('tracking-order-id');

  if (!trackingForm || !trackingResult) return;

  const loadOrder = async (orderId) => {
    if (!orderId) {
      trackingResult.innerHTML = '<p>Veuillez saisir un numéro de commande.</p>';
      return;
    }

    try {
      const orders = await fetchJson('/api/orders');
      const order = orders.find((item) => String(item.id) === String(orderId));
      if (!order) {
        trackingResult.innerHTML = '<p>Commande introuvable. Vérifiez le numéro.</p>';
        return;
      }

      const currentStatus = getStatusLabel(order.status || 'preparation');
      const courier = getDeliveryInfo(order);
      const orderItems = (order.items || []).map((item) => `
        <li>${item.product_name || 'Produit'} × ${item.quantity} — ${formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</li>
      `).join('');

      const statusSteps = ['preparation', 'en_route', 'livree'];
      const currentIndex = statusSteps.includes(order.status || 'preparation') ? statusSteps.indexOf(order.status) : 0;

      trackingResult.innerHTML = `
        <div class="tracking-panel">
          <div class="tracking-header">
            <div>
              <span class="eyebrow">Commande</span>
              <h3>#${order.id}</h3>
            </div>
            <span class="invoice-badge">${order.invoice_number || 'Facture en cours'}</span>
          </div>

          <div class="tracking-meta">
            <p><strong>Client :</strong> ${order.customer_name || 'Client'}</p>
            <p><strong>Téléphone :</strong> ${order.customer_phone || 'Non renseigné'}</p>
            <p><strong>Ville :</strong> ${order.city || 'Non précisée'}</p>
            <p><strong>Statut :</strong> ${currentStatus}</p>
            <p><strong>Livreur :</strong> ${courier.name} • <a href="${buildCourierLink(courier.phone)}">${courier.phone}</a></p>
          </div>

          <div class="tracking-steps compact">
            ${statusSteps.map((step, index) => `
              <div class="tracking-step ${index <= currentIndex ? 'is-active' : ''}">
                <span>${index + 1}</span>
                <small>${step === 'preparation' ? 'Préparation' : step === 'en_route' ? 'En route' : 'Livrée'}</small>
              </div>
            `).join('')}
          </div>

          <div class="invoice-box compact-box">
            <h4>Contenu de la commande</h4>
            <ul>${orderItems || '<li>Produit unique</li>'}</ul>
            <p><strong>Total :</strong> ${formatPrice(Number(order.total || 0))}</p>
          </div>
        </div>
      `;
    } catch (error) {
      trackingResult.innerHTML = `<p>${error.message}</p>`;
    }
  };

  const params = new URLSearchParams(window.location.search);
  if (params.get('id')) {
    trackingInput.value = params.get('id');
    loadOrder(params.get('id'));
  }

  trackingForm.addEventListener('submit', (event) => {
    event.preventDefault();
    loadOrder(trackingInput.value.trim());
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
  bindCatalogSearch();
  bindExpandableContent();
  bindAuthForms();
  bindAdminPanel();
  bindTrackingPage();
  setupTrackingMenuLink();
  setupAdminMenuLink();
  setupBurgerMenu();
  setupObserver();
});
