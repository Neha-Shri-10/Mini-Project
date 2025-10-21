const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// ================= Middleware =================
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads')); // Serve uploaded images
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= MySQL Connection =================
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Thars-2005', // your password
  database: 'artisans'    // your DB
});
db.connect(err => {
  if (err) throw err;
  console.log("✅ MySQL Connected");
});

// ================= Multer Setup =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ================= Signup Route =================
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword],
      (err) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Email already exists' });
          }
          return res.status(500).json({ message: 'Database error' });
        }
        res.status(201).json({ message: 'User registered successfully' });
      }
    );
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ================= Login Route =================
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.query('SELECT * FROM users WHERE email = ?', [username], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    res.json({
      message: 'Login successful',
      user: { id: user.id, name: user.name, email: user.email }
    });
  });
});

// ================= Seller Submits Product =================
app.post('/submitProduct', upload.single('productImage'), (req, res) => {
  const {
    sellerName,
    sellerEmail,
    sellerPhone,
    productName,
    productCategory,
    productDescription,
    productPrice,
    productQuantity
  } = req.body;

  const imagePath = req.file ? '/uploads/' + req.file.filename : '';

  const sql = `
    INSERT INTO products_pending 
    (sellerName, sellerEmail, sellerPhone, productName, productCategory, productDescription, productPrice, productQuantity, productImage) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [
    sellerName,
    sellerEmail,
    sellerPhone,
    productName,
    productCategory,
    productDescription,
    productPrice,
    productQuantity,
    imagePath
  ], (err) => {
    if (err) {
      console.error('Error saving product:', err);
      return res.status(500).json({ success: false, message: 'Failed to submit product' });
    }
    res.json({ success: true, message: "Product submitted for review" });
  });
});
// ================= Admin Approves Product =================
app.post('/admin/approve/:id', (req, res) => {
  const productId = req.params.id;

  // Step 1: Fetch product details from pending table
  db.query("SELECT * FROM products_pending WHERE id = ?", [productId], (err, result) => {
    if (err) {
      console.error("Error fetching product:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }

    if (result.length === 0) {
      return res.json({ success: false, message: "Product not found" });
    }

    const product = result[0];

    // Step 2: Insert approved product into main products table
    const sqlInsert = `
      INSERT INTO products 
      (sellerName, sellerEmail, productName, productCategory, productDescription, productPrice, productQuantity, productImage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      sqlInsert,
      [
        product.sellerName,
        product.sellerEmail,
        product.productName,
        product.productCategory,
        product.productDescription,
        product.productPrice,
        product.productQuantity,
        product.productImage
      ],
      (err2) => {
        if (err2) {
          console.error("Error inserting product:", err2);
          return res.status(500).json({ success: false, message: "Failed to approve product" });
        }

        // Step 3: Delete from pending table
        db.query("DELETE FROM products_pending WHERE id = ?", [productId], (err3) => {
          if (err3) {
            console.error("Error deleting from pending:", err3);
            return res.status(500).json({ success: false, message: "Failed to remove pending product" });
          }

          res.json({ success: true, message: "✅ Product approved and moved to main list" });
        });
      }
    );
  });
});
// ===== Admin Add Product Directly =====
app.post('/admin/add-product', upload.single('productImage'), (req, res) => {
  const {
    sellerName,
    sellerEmail,
    productName,
    productCategory,
    productDescription,
    productPrice,
    productQuantity
  } = req.body;

  const imagePath = req.file ? '/uploads/' + req.file.filename : '';

  const sqlInsert = `
    INSERT INTO products 
    (sellerName, sellerEmail, productName, productCategory, productDescription, productPrice, productQuantity, productImage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sqlInsert, [
    sellerName,
    sellerEmail,
    productName,
    productCategory,
    productDescription,
    productPrice,
    productQuantity,
    imagePath
  ], (err) => {
    if (err) {
      console.error("Error adding product by admin:", err);
      return res.status(500).json({ success: false, message: "Failed to add product" });
    }

    res.json({ success: true, message: "✅ Product added successfully by Admin" });
  });
});


// ================= Admin Login =================
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;

  db.query("SELECT * FROM admin_users WHERE username = ?", [username], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "DB error" });
    if (results.length === 0) return res.json({ success: false, message: "Invalid username" });

    const admin = results[0];
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.json({ success: false, message: "Invalid password" });

    res.json({ success: true, message: "Login successful" });
  });
});

// ================= Admin Views Pending Products =================
app.get('/admin/products/pending', (req, res) => {
  db.query("SELECT * FROM products_pending", (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

// ================= Admin Approves Product =================
app.post('/admin/approve/:id', (req, res) => {
  const productId = req.params.id;

  db.query("SELECT * FROM products_pending WHERE id = ?", [productId], (err, result) => {
    if (err) throw err;
    if (result.length === 0) {
      return res.json({ success: false, message: "Product not found" });
    }

    const product = result[0];
    const sqlInsert = `
      INSERT INTO products 
      (sellerName, sellerEmail, productName, productCategory, productDescription, productPrice, productQuantity, productImage) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sqlInsert, [
      product.sellerName,
      product.sellerEmail,
      product.productName,
      product.productCategory,
      product.productDescription,
      product.productPrice,
      product.productQuantity,
      product.productImage
    ], (err2) => {
      if (err2) throw err2;

      db.query("DELETE FROM products_pending WHERE id = ?", [productId]);
      res.json({ success: true, message: "Product approved and moved to main list" });
    });
  });
});

app.delete('/admin/reject/:id', (req, res) => {
  const productId = req.params.id;
  db.query("DELETE FROM products_pending WHERE id = ?", [productId], (err) => {
    if (err) return res.status(500).json({ message: "Error rejecting product" });
    res.json({ success: true, message: "Product rejected successfully" });
  });
});

// ===== View All Products (Approved) =====
app.get('/admin/products/all', (req, res) => {
  db.query("SELECT * FROM products", (err, results) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(results);
  });
});

// ===== View Sales =====
app.get('/admin/sales', (req, res) => {
  db.query("SELECT * FROM sales", (err, results) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(results);
  });
});


// ===== Get products by category =====
app.get('/products/category/:category', (req, res) => {
  const category = req.params.category;
  db.query("SELECT * FROM products WHERE productCategory = ?", [category], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json(results);
  });
});

// ===== Update Admin Credentials =====
// ===== Change Admin Password =====
app.post('/admin/change-password', (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  if (!username || !currentPassword || !newPassword)
    return res.status(400).json({ success: false, message: "Missing fields" });

  db.query("SELECT * FROM admin_users WHERE username = ?", [username], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "DB error" });
    if (results.length === 0)
      return res.status(404).json({ success: false, message: "Admin not found" });

    const admin = results[0];
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: "Incorrect current password" });

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    db.query(
      "UPDATE admin_users SET password = ? WHERE id = ?",
      [hashedNewPassword, admin.id],
      (err2) => {
        if (err2)
          return res.status(500).json({ success: false, message: "Error updating password" });

        res.json({ success: true, message: "Admin password updated successfully" });
      }
    );
  });
});


// Remove approved product
app.delete('/admin/remove/:id', (req, res) => {
  const productId = req.params.id;
  db.query("DELETE FROM products WHERE id = ?", [productId], (err) => {
    if (err) return res.status(500).json({ success: false, message: "Error removing product" });
    res.json({ success: true, message: "Product removed successfully" });
  });
});
app.get("/admin/orders", (req, res) => {
  const sql = `
    SELECT o.id, u.name AS customer, o.userEmail, p.productName, 
           o.quantity, o.totalPrice, o.paymentMethod, o.address, o.pincode,
           o.status, o.orderDate
    FROM orders o
    LEFT JOIN products p ON o.productId = p.id
    LEFT JOIN users u ON o.userEmail = u.email
    ORDER BY o.orderDate DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

app.post("/orders", (req, res) => {
  const { userEmail, productId, quantity, totalPrice, paymentMethod, address, pincode } = req.body;

  if (!userEmail || !productId || !quantity || !paymentMethod || !address || !pincode) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  const sql = `
    INSERT INTO orders 
    (userEmail, productId, quantity, totalPrice, paymentMethod, address, pincode) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [userEmail, productId, quantity, totalPrice, paymentMethod, address, pincode], (err, result) => {
    if (err) {
      console.error("❌ Error saving order:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }
    res.json({ success: true, orderId: result.insertId });
  });
});




// ===== Upload/Update Profile Image =====
app.post('/api/upload-profile', upload.single('profileImage'), (req, res) => {
  const { userId } = req.body;
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

  const imagePath = '/uploads/' + req.file.filename;

  const sql = "UPDATE users SET profile_image = ? WHERE id = ?";
  db.query(sql, [imagePath, userId], (err) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    res.json({ success: true, message: "Profile picture updated", imagePath });
  });
});

// ===== Remove Profile Image =====
app.post('/api/remove-profile', (req, res) => {
  const { userId } = req.body;

  // First, get current image to delete the file if exists
  db.query("SELECT profile_image FROM users WHERE id = ?", [userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "DB error" });
    if (results.length === 0) return res.status(404).json({ success: false, message: "User not found" });

    const oldImage = results[0].profile_image;
    if (oldImage) {
      const filePath = path.join(__dirname, oldImage);
      fs.unlink(filePath, (err) => {
        if (err) console.warn("Could not delete old profile image:", err.message);
      });
    }

    // Set profile_image column to NULL
    db.query("UPDATE users SET profile_image = NULL WHERE id = ?", [userId], (err2) => {
      if (err2) return res.status(500).json({ success: false, message: "Failed to remove profile image" });
      res.json({ success: true, message: "Profile image removed" });
    });
  });
});

// ===== Get Product by ID =====
app.get("/products/:id", (req, res) => {
  const productId = req.params.id;

  db.query("SELECT * FROM products WHERE id = ?", [productId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0) return res.status(404).json({ message: "Product not found" });

    res.json(results[0]); // send single product object
  });
});
// ===== Change User Password =====
app.post('/api/change-password', (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;

  if (!userId || !currentPassword || !newPassword)
    return res.status(400).json({ success: false, message: "Missing fields" });

  db.query("SELECT password FROM users WHERE id = ?", [userId], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "DB error" });
    if (results.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    const user = results[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: "Incorrect current password" });

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    db.query("UPDATE users SET password = ? WHERE id = ?", [hashedNewPassword, userId], (err2) => {
      if (err2)
        return res.status(500).json({ success: false, message: "Error updating password" });

      res.json({ success: true, message: "Password updated successfully" });
    });
  });
});
// ===== Get My Orders (For Logged-in User) =====
app.get("/api/myorders/:userEmail", (req, res) => {
  const { userEmail } = req.params;

  const sql = `
    SELECT o.id, p.productName, p.productImage, p.productPrice, o.quantity, 
           o.totalPrice, o.paymentMethod, o.status, o.orderDate
    FROM orders o
    LEFT JOIN products p ON o.productId = p.id
    WHERE o.userEmail = ?
    ORDER BY o.orderDate DESC
  `;

  db.query(sql, [userEmail], (err, results) => {
    if (err) {
      console.error("❌ Error fetching orders:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }

    res.json(results);
  });
});

// Add product to favourites
app.post("/api/favourites/add", (req, res) => {
  const { userEmail, productId } = req.body;
  if (!userEmail || !productId) return res.status(400).json({ success: false, message: "Missing fields" });

  const sql = "INSERT INTO favourites (userEmail, productId) VALUES (?, ?)";

  db.query(sql, [userEmail, productId], (err) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") return res.json({ success: false, message: "Already in favourites" });
      return res.status(500).json({ success: false, message: "Database error" });
    }
    res.json({ success: true, message: "Added to favourites" });
  });
});

// Remove product from favourites
app.post("/api/favourites/remove", (req, res) => {
  const { userEmail, productId } = req.body;
  if (!userEmail || !productId) return res.status(400).json({ success: false, message: "Missing fields" });

  const sql = "DELETE FROM favourites WHERE userEmail = ? AND productId = ?";
  db.query(sql, [userEmail, productId], (err) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    res.json({ success: true, message: "Removed from favourites" });
  });
});

// Get all favourites for a user
app.get("/api/favourites/:userEmail", (req, res) => {
  const { userEmail } = req.params;
  const sql = `
    SELECT f.id, p.* 
    FROM favourites f 
    LEFT JOIN products p ON f.productId = p.id
    WHERE f.userEmail = ?
    ORDER BY f.addedAt DESC
  `;
  db.query(sql, [userEmail], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    res.json(results);
  });
});

// ================= Start Server =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
