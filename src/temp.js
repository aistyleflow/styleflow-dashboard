import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

function Products({ owner }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [form, setForm] = useState({
    product_name: '',
    price: '',
    stock: '',
    size: '',
    color: '',
    category: '',
    image_url: ''
  })

  useEffect(() => {
    fetchProducts()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchProducts() {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', owner.id)
        .order('id', { ascending: false })

      if (error) {
        setError(error.message)
        return
      }

      setProducts(data)

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleAddClick() {
    setEditProduct(null)
    setForm({
      product_name: '',
      price: '',
      stock: '',
      size: '',
      color: '',
      category: '',
      image_url: ''
    })
    setShowForm(true)
  }

  function handleEditClick(product) {
    setEditProduct(product)
    setForm({
      product_name: product.product_name,
      price: product.price,
      stock: product.stock,
      size: product.size || '',
      color: product.color || '',
      category: product.category || '',
      image_url: product.image_url || ''
    })
    setShowForm(true)
  }

  async function handleSave() {
    try {
      if (!form.product_name || !form.price || !form.stock) {
        alert('Please fill Name, Price and Stock')
        return
      }

      const productData = {
        product_name: form.product_name,
        price: Number(form.price),
        stock: Number(form.stock),
        size: form.size,
        color: form.color,
        category: form.category,
        image_url: form.image_url,
        store_id: owner.id
      }

      if (editProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editProduct.id)

        if (error) {
          alert('Could not update product. Try again!')
          return
        }

        console.log('✅ Product updated:', form.product_name)

      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData)

        if (error) {
          alert('Could not add product. Try again!')
          return
        }

        console.log('✅ Product added:', form.product_name)
      }

      setShowForm(false)
      fetchProducts()

    } catch (err) {
      console.error('❌ Save error:', err.message)
    }
  }

  async function handleDelete(productId, productName) {
    if (!window.confirm(`Delete "${productName}"?`)) return

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)

    if (error) {
      alert('Could not delete product. Try again!')
      return
    }

    console.log('✅ Product deleted:', productId)
    fetchProducts()
  }

  // ✅ Parse sizes
  function getSizes(sizeString) {
    if (!sizeString) return []
    return sizeString.split(',').map(s => s.trim()).filter(s => s)
  }

  return (
    <div style={styles.container}>

      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>📦 Products</h2>
        <button style={styles.addBtn} onClick={handleAddClick}>
          ➕ Add Product
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div style={styles.formBox}>
          <h3 style={styles.formTitle}>
            {editProduct ? '✏️ Edit Product' : '➕ Add New Product'}
          </h3>

          <div style={styles.formGrid}>
            {[
              { label: 'Product Name *', name: 'product_name', type: 'text',   placeholder: 'e.g. Black Hoodie' },
              { label: 'Price (₹) *',    name: 'price',        type: 'number', placeholder: 'e.g. 999' },
              { label: 'Stock *',        name: 'stock',        type: 'number', placeholder: 'e.g. 50' },
              { label: 'Size',           name: 'size',         type: 'text',   placeholder: 'e.g. S, M, L, XL, XXL' },
              { label: 'Color',          name: 'color',        type: 'text',   placeholder: 'e.g. Black' },
              { label: 'Category',       name: 'category',     type: 'text',   placeholder: 'e.g. T-Shirts' },
              { label: 'Image URL',      name: 'image_url',    type: 'text',   placeholder: 'https://...' },
            ].map((field) => (
              <div key={field.name} style={styles.formField}>
                <label style={styles.label}>{field.label}</label>
                <input
                  style={styles.input}
                  type={field.type}
                  name={field.name}
                  placeholder={field.placeholder}
                  value={form[field.name]}
                  onChange={handleChange}
                />
              </div>
            ))}
          </div>

          <div style={styles.formActions}>
            <button style={styles.saveBtn} onClick={handleSave}>
              {editProduct ? '✅ Update Product' : '✅ Save Product'}
            </button>
            <button style={styles.cancelBtn} onClick={() => setShowForm(false)}>
              ❌ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={styles.center}>
          <p style={styles.loadingText}>⏳ Loading products...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={styles.errorBox}>
          <p>❌ Error: {error}</p>
          <button style={styles.retryBtn} onClick={fetchProducts}>Retry</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && products.length === 0 && (
        <div style={styles.center}>
          <p style={styles.emptyText}>📭 No products yet.</p>
          <p style={styles.emptySubText}>
            Click "Add Product" to add your first product.
          </p>
        </div>
      )}

      {/* ✅ Products Grid — Edit and Delete only */}
      {!loading && !error && products.length > 0 && (
        <div style={styles.productsGrid}>
          {products.map((product) => (
            <div key={product.id} style={styles.productCard}>

              {/* Product Image */}
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.product_name}
                  style={styles.productImage}
                />
              ) : (
                <div style={styles.noImageBox}>
                  <span style={styles.noImageText}>🖼️ No Image</span>
                </div>
              )}

              {/* Product Details */}
              <div style={styles.productInfo}>
                <h3 style={styles.productName}>{product.product_name}</h3>
                <p style={styles.productPrice}>💰 ₹{product.price}</p>
                <p style={styles.productMeta}>
                  🎨 {product.color || '-'} | 🏷️ {product.category || '-'}
                </p>

                {/* Sizes */}
                {product.size && (
                  <div style={styles.sizesRow}>
                    <span style={styles.sizeLabel}>📐 Sizes:</span>
                    {getSizes(product.size).map(size => (
                      <span key={size} style={styles.sizeTag}>{size}</span>
                    ))}
                  </div>
                )}

                {/* Stock badge */}
                <span style={{
                  ...styles.stockBadge,
                  backgroundColor: product.stock > 10 ? '#e8f5e9' : '#ffebee',
                  color: product.stock > 10 ? '#2e7d32' : '#c62828'
                }}>
                  📦 Stock: {product.stock}
                </span>
              </div>

              {/* ✅ Edit and Delete only — no Add to Cart */}
              <div style={styles.cardActions}>
                <button
                  style={styles.editBtn}
                  onClick={() => handleEditClick(product)}
                >
                  ✏️ Edit
                </button>
                <button
                  style={styles.deleteBtn}
                  onClick={() => handleDelete(product.id, product.product_name)}
                >
                  🗑️ Delete
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  )
}

const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    padding: '20px 0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    backgroundColor: '#fff',
    padding: '16px 20px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  title: {
    margin: 0,
    fontSize: '22px',
    color: '#333',
  },
  addBtn: {
    padding: '10px 20px',
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  formBox: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  formTitle: {
    margin: '0 0 20px',
    fontSize: '18px',
    color: '#333',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    color: '#555',
    fontWeight: 'bold',
  },
  input: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#fafafa',
  },
  formActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  },
  saveBtn: {
    padding: '10px 24px',
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  cancelBtn: {
    padding: '10px 24px',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  productsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '16px',
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  productImage: {
    width: '100%',
    height: '180px',
    objectFit: 'cover',
  },
  noImageBox: {
    width: '100%',
    height: '180px',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    color: '#999',
    fontSize: '14px',
  },
  productInfo: {
    padding: '16px',
    flex: 1,
  },
  productName: {
    margin: '0 0 8px',
    fontSize: '16px',
    color: '#333',
  },
  productPrice: {
    margin: '0 0 6px',
    fontSize: '15px',
    color: '#333',
    fontWeight: 'bold',
  },
  productMeta: {
    margin: '0 0 8px',
    fontSize: '13px',
    color: '#666',
  },
  sizesRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '4px',
    marginBottom: '8px',
  },
  sizeLabel: {
    fontSize: '12px',
    color: '#666',
    marginRight: '4px',
  },
  sizeTag: {
    padding: '2px 8px',
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  stockBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    marginTop: '4px',
  },
  // ✅ Edit and Delete only
  cardActions: {
    padding: '12px 16px',
    borderTop: '1px solid #f0f0f0',
    display: 'flex',
    gap: '8px',
  },
  editBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#FF9800',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
  },
  deleteBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#F44336',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
  },
  center: {
    textAlign: 'center',
    padding: '60px',
  },
  loadingText: {
    fontSize: '18px',
    color: '#999',
  },
  emptyText: {
    fontSize: '20px',
    color: '#666',
  },
  emptySubText: {
    fontSize: '14px',
    color: '#999',
  },
  errorBox: {
    backgroundColor: '#ffebee',
    border: '1px solid #ffcdd2',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center',
    color: '#c62828',
    marginBottom: '16px',
  },
  retryBtn: {
    padding: '8px 16px',
    backgroundColor: '#F44336',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginTop: '8px',
  },
}

export default Products