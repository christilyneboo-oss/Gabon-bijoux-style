const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const dataFile = path.join(dataDir, 'store.db');

fs.mkdirSync(dataDir, { recursive: true });
const db = new sqlite3.Database(dataFile);

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onRun(err) {
    if (err) {
      reject(err);
      return;
    }
    resolve({ id: this.lastID, changes: this.changes });
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) {
      reject(err);
      return;
    }
    resolve(row);
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) {
      reject(err);
      return;
    }
    resolve(rows);
  });
});

async function ensureColumn(tableName, columnName, columnDefinition) {
  const columns = await all(`PRAGMA table_info(${tableName})`);
  if (!columns.some((column) => column.name === columnName)) {
    await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
  }
}

async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    )
  `);

  await ensureColumn('users', 'role', 'role TEXT NOT NULL DEFAULT "user"');

  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      description TEXT DEFAULT '',
      image TEXT DEFAULT 'images/placeholder.svg'
    )
  `);

  await ensureColumn('products', 'stock', 'stock INTEGER NOT NULL DEFAULT 0');

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      customer_name TEXT,
      customer_phone TEXT,
      city TEXT,
      message TEXT,
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  await ensureColumn('orders', 'customer_name', 'customer_name TEXT');
  await ensureColumn('orders', 'customer_phone', 'customer_phone TEXT');
  await ensureColumn('orders', 'city', 'city TEXT');
  await ensureColumn('orders', 'message', 'message TEXT');
  await ensureColumn('orders', 'total', 'total INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('orders', 'status', 'status TEXT NOT NULL DEFAULT "pending"');
  await ensureColumn('orders', 'created_at', 'created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP');

  await run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price INTEGER NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  const adminEmail = 'gabonbijouxstyle@gmail.com';
  const adminPassword = '12345678';
  const admin = await get('SELECT * FROM users WHERE email = ?', [adminEmail]);

  if (admin) {
    await run('UPDATE users SET name = ?, password = ?, role = ? WHERE id = ?', ['Admin', adminPassword, 'admin', admin.id]);
  } else {
    const existingAdmin = await get('SELECT * FROM users WHERE role = ? ORDER BY id LIMIT 1', ['admin']);
    if (existingAdmin) {
      await run('UPDATE users SET name = ?, email = ?, password = ?, role = ? WHERE id = ?', ['Admin', adminEmail, adminPassword, 'admin', existingAdmin.id]);
    } else {
      await run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', ['Admin', adminEmail, adminPassword, 'admin']);
    }
  }

  const existingProducts = await all('SELECT * FROM products');
  const legacyProductNames = [
    'Collier Nyare',
    'Bracelet Okoumé',
    'Boucles Ogooué',
    'Bague Lambaréné',
    'Chaîne Mandji',
    'Bracelet Duo'
  ];

  if (Array.isArray(existingProducts) && existingProducts.length > 0) {
    const staleProductIds = existingProducts
      .filter((product) => legacyProductNames.some((name) => product.name && product.name.toLowerCase() === name.toLowerCase()))
      .map((product) => product.id);

    if (staleProductIds.length > 0) {
      await run(`DELETE FROM products WHERE id IN (${staleProductIds.map(() => '?').join(', ')})`, staleProductIds);
    }
  }

}

function LegacyProductNamesDefined(existingProducts, legacyProductNames) {
  return !!(existingProducts && Number(existingProducts.total) > 0 && legacyProductNames.length);
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(rootDir));

async function createOrderFromPayload(payload) {
  const { userId, items, name, telephone, city, message } = payload || {};
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Commande invalide.');
  }

  const total = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const orderResult = await run(
    'INSERT INTO orders (user_id, customer_name, customer_phone, city, message, total, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId ? Number(userId) : null, name ? String(name).trim() : '', telephone ? String(telephone).trim() : '', city ? String(city).trim() : '', message ? String(message).trim() : '', total, 'pending']
  );

  for (const item of items) {
    await run('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [
      orderResult.id,
      Number(item.productId),
      Number(item.quantity || 1),
      Number(item.price || 0)
    ]);
  }

  return {
    id: orderResult.id,
    userId: userId ? Number(userId) : null,
    customerName: name ? String(name).trim() : '',
    customerPhone: telephone ? String(telephone).trim() : '',
    city: city ? String(city).trim() : '',
    message: message ? String(message).trim() : '',
    total,
    status: 'pending'
  };
}

app.get('/api/products', async (req, res) => {
  try {
    const products = await all('SELECT * FROM products ORDER BY id DESC');
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  const lowerEmail = String(email).trim().toLowerCase();

  try {
    const exists = await get('SELECT id FROM users WHERE email = ?', [lowerEmail]);
    if (exists) {
      return res.status(409).json({ error: 'Cet email est déjà inscrit.' });
    }

    const userResult = await run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [
      String(name).trim(),
      lowerEmail,
      String(password),
      'user'
    ]);

    const user = await get('SELECT id, name, email, role FROM users WHERE id = ?', [userResult.id]);
    return res.status(201).json(user);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  try {
    const user = await get(
      'SELECT id, name, email, role FROM users WHERE email = ? AND password = ?',
      [String(email).trim().toLowerCase(), String(password)]
    );

    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  const { name, category, price, stock, description, image } = req.body || {};
  if (!name || !category || !price) {
    return res.status(400).json({ error: 'Nom, catégorie et prix obligatoires.' });
  }

  try {
    const productResult = await run(
      'INSERT INTO products (name, category, price, stock, description, image) VALUES (?, ?, ?, ?, ?, ?)',
      [String(name).trim(), String(category).trim(), Number(price), Number(stock || 0), String(description || ''), String(image || 'images/placeholder.svg')]
    );

    const product = await get('SELECT * FROM products WHERE id = ?', [productResult.id]);
    return res.status(201).json(product);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, price, stock, description, image } = req.body || {};
  if (!name || !category || !price) {
    return res.status(400).json({ error: 'Nom, catégorie et prix obligatoires.' });
  }

  try {
    const current = await get('SELECT id FROM products WHERE id = ?', [id]);
    if (!current) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }

    await run(
      'UPDATE products SET name = ?, category = ?, price = ?, stock = ?, description = ?, image = ? WHERE id = ?',
      [String(name).trim(), String(category).trim(), Number(price), Number(stock || 0), String(description || ''), String(image || 'images/placeholder.svg'), Number(id)]
    );

    const updated = await get('SELECT * FROM products WHERE id = ?', [id]);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await run('DELETE FROM products WHERE id = ?', [Number(id)]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }

    await run('DELETE FROM order_items WHERE product_id = ?', [Number(id)]);
    return res.json({ success: true, deletedId: Number(id) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await all('SELECT * FROM orders ORDER BY id DESC');
    const enrichedOrders = [];

    for (const order of orders) {
      const items = await all(`
        SELECT oi.*, p.name AS product_name
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
        ORDER BY oi.id DESC
      `, [order.id]);

      enrichedOrders.push({
        ...order,
        items
      });
    }

    res.json(enrichedOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const allowed = ['pending', 'confirmed', 'shipped', 'delivered'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }

  try {
    const current = await get('SELECT id FROM orders WHERE id = ?', [Number(id)]);
    if (!current) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }

    await run('UPDATE orders SET status = ? WHERE id = ?', [status, Number(id)]);
    const updated = await get('SELECT * FROM orders WHERE id = ?', [Number(id)]);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const order = await createOrderFromPayload(req.body || {});
    return res.status(201).json(order);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route introuvable.' });
  }

  const requestedFile = path.join(rootDir, req.path === '/' ? 'index.html' : req.path);
  if (fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()) {
    return res.sendFile(requestedFile);
  }

  return res.sendFile(path.join(rootDir, 'index.html'));
});

(async () => {
  try {
    await initDatabase();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Serveur lancé sur http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Erreur d’initialisation de la base SQLite :', error);
    process.exit(1);
  }
})();
