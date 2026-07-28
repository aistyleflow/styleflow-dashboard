import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase.js'

function Products({ owner }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState(null)      // ✅ STEP 2
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)                     // ✅ STEP 2
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
    if (owner?.id) fetchProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', Number(owner.id))
        .order('id', { ascending: false })

      if (error) { console.error('❌ fetchProducts error:', error.message); return }
      setProducts(data || [])
    } catch (err) {
      console.error('❌ fetchProducts error:', err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // ✅ STEP 3 — file picker handler
  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
  }

  // ✅ STEP 4 — upload function
  async function uploadProductImage() {
  if (!imageFile) return form.image_url || ''

  try {
    setUploading(true)

    // Convert every uploaded image to JPG
    const img = new Image()
    img.src = URL.createObjectURL(imageFile)

    await new Promise((resolve) => {
      img.onload = resolve
    })

    const canvas = document.createElement("canvas")
    canvas.width = img.width
    canvas.height = img.height

    const ctx = canvas.getContext("2d")
    ctx.drawImage(img, 0, 0)

    const jpgBlob = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/jpeg", 0.95)
    )

    const fileName = `${owner.id}-${Date.now()}.jpg`
    const filePath = `products/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, jpgBlob, {
        contentType: "image/jpeg"
      })

    if (uploadError) {
      console.error(uploadError)
      alert("Image upload failed")
      return ""
    }

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath)

    return data.publicUrl

  } catch (err) {
    console.error(err)
    alert("Image upload failed")
    return ""
  } finally {
    setUploading(false)
  }
}
  // ✅ STEP 6 — reset imageFile when Add opens
  function handleAddClick() {
    setEditProduct(null)
    setImageFile(null)
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

  // ✅ STEP 7 — reset imageFile when Edit opens
  function handleEditClick(product) {
    setEditProduct(product)
    setImageFile(null)
    setForm({
      product_name: product.product_name || '',
      price: product.price || '',
      stock: product.stock || '',
      size: product.size || '',
      color: product.color || '',
      category: product.category || '',
      image_url: product.image_url || ''
    })
    setShowForm(true)
  }

  function removeImage() {
    setImageFile(null)

    setForm(prev => ({
      ...prev,
      image_url: ''
    }))

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  function handleCancel() {  
    setShowForm(false)
    setEditProduct(null)
    setImageFile(null)
  }

  // ✅ STEP 5 — handleSave with image upload
  async function handleSave() {
    try {
      setSaving(true)

      if (!form.product_name.trim()) {
        alert('Product name is required')
        return
      }

      // ✅ Upload image first if file selected
      let finalImageUrl = form.image_url

      if (imageFile) {
        finalImageUrl = await uploadProductImage()
        if (!finalImageUrl) return
      }

      const productData = {
        product_name: form.product_name.trim(),
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
        size: form.size.trim(),
        color: form.color.trim(),
        category: form.category.trim(),
        image_url: finalImageUrl,   // ✅ use finalImageUrl not form.image_url
        store_id: Number(owner.id),
      }

      if (editProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editProduct.id)

        if (error) { console.error('❌ Update error:', error.message); return }
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData)

        if (error) { console.error('❌ Insert error:', error.message); return }
      }

      setShowForm(false)
      setEditProduct(null)
      setImageFile(null)
      fetchProducts()

    } catch (err) {
      console.error('❌ handleSave error:', err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(productId) {
    if (!window.confirm('Delete this product?')) return

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)

    if (error) { console.error('❌ Delete error:', error.message); return }
    fetchProducts()
  }

  return (
    <div style={styles.container}>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>📦 Products</h2>
          <p style={styles.subtitle}>{products.length} product{products.length !== 1 ? 's' : ''} in your store</p>
        </div>
        <button style={styles.addBtn} onClick={handleAddClick}>
          ➕ Add Product
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>
            {editProduct ? '✏️ Edit Product' : '➕ Add New Product'}
          </h3>

          {/* Form fields grid — all except image_url */}
          <div style={styles.formGrid}>
            {[
              { label: 'Product Name *', name: 'product_name', type: 'text',   placeholder: 'e.g. Black Baggy Pant' },
              { label: 'Price (₹)',      name: 'price',        type: 'number', placeholder: 'e.g. 1599'             },
              { label: 'Stock',          name: 'stock',        type: 'number', placeholder: 'e.g. 50'               },
              { label: 'Sizes',          name: 'size',         type: 'text',   placeholder: 'e.g. S,M,L,XL'         },
              { label: 'Color',          name: 'color',        type: 'text',   placeholder: 'e.g. Black'             },
              { label: 'Category',       name: 'category',     type: 'text',   placeholder: 'e.g. Pants'             },
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

          {/* ✅ STEP 8 — file upload instead of URL input */}
          <div style={styles.formField}>
            <label style={styles.label}>Product Image</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={styles.fileInput}
            />
          </div>

          {/* ✅ STEP 9 — image preview */}
          {(imageFile || form.image_url) && (
            <div style={{ marginTop: '12px' }}>
              <img
                src={imageFile ? URL.createObjectURL(imageFile) : form.image_url}
                alt="Preview"
                style={{
                  width: '120px',
                  height: '120px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '1px solid #ddd'
                }}
              />

              <br /><br />

              <button
                type="button"
                onClick={removeImage}
                style={{
                  background: "#F44336",
                  color: "#fff",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                ❌ Remove Image
              </button>
            </div>
          )}

          <div style={styles.formButtons}>
            <button style={styles.cancelBtn} onClick={handleCancel}>
              Cancel
            </button>
            {/* ✅ STEP 10 — save button shows upload state */}
            <button
              style={{
                ...styles.saveBtn,
                opacity: saving || uploading ? 0.7 : 1
              }}
              onClick={handleSave}
              disabled={saving || uploading}
            >
              {uploading
                ? '⏳ Uploading image...'
                : saving
                  ? '⏳ Saving...'
                  : editProduct
                    ? '✅ Update Product'
                    : '✅ Save Product'}
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

      {/* Empty */}
      {!loading && products.length === 0 && !showForm && (
        <div style={styles.center}>
          <p style={styles.emptyText}>📭 No products yet.</p>
          <p style={styles.emptySubText}>Click Add Product to get started!</p>
        </div>
      )}

      {/* Products Grid */}
      {!loading && products.length > 0 && (
        <div style={styles.productsGrid}>
          {products.map((product) => (
            <div key={product.id} style={styles.productCard}>

              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.product_name}
                  style={styles.productImage}
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              )}

              <div style={styles.productInfo}>
                <p style={styles.productName}>{product.product_name}</p>
                <p style={styles.productPrice}>💰 ₹{product.price}</p>
                <p style={styles.productDetail}>📦 Stock: {product.stock}</p>
                {product.size && <p style={styles.productDetail}>📐 Sizes: {product.size}</p>}
                {product.color && <p style={styles.productDetail}>🎨 Color: {product.color}</p>}
                {product.category && <p style={styles.productDetail}>🏷️ {product.category}</p>}
              </div>

              <div style={styles.productActions}>
                <button
                  style={styles.editBtn}
                  onClick={() => handleEditClick(product)}
                >
                  ✏️ Edit
                </button>
                <button
                  style={styles.deleteBtn}
                  onClick={() => handleDelete(product.id)}
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
  container: { padding: '0' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: '16px 20px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: '20px',
  },
  title: { margin: 0, fontSize: '22px', color: '#333' },
  subtitle: { margin: '4px 0 0', fontSize: '13px', color: '#999' },
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
  formCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: '20px',
  },
  formTitle: { margin: '0 0 20px', fontSize: '18px', color: '#333' },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '16px',
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '4px',
  },
  label: { fontSize: '14px', color: '#555', fontWeight: 'bold' },
  input: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#fafafa',
  },
  fileInput: {
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
    backgroundColor: '#fafafa',
    cursor: 'pointer',
  },
  formButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '20px',
  },
  cancelBtn: {
    padding: '10px 20px',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
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
  center: { textAlign: 'center', padding: '60px' },
  loadingText: { fontSize: '18px', color: '#999' },
  emptyText: { fontSize: '20px', color: '#666' },
  emptySubText: { fontSize: '14px', color: '#999' },
  productsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '16px',
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
  },
  productImage: {
    width: '100%',
    height: '180px',
    objectFit: 'cover',
  },
  productInfo: {
    padding: '16px',
    flex: 1,
  },
  productName: {
    margin: '0 0 8px',
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#333',
  },
  productPrice: {
    margin: '0 0 4px',
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  productDetail: {
    margin: '2px 0',
    fontSize: '13px',
    color: '#666',
  },
  productActions: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1px solid #f0f0f0',
  },
  editBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
  },
  deleteBtn: {
    flex: 1,
    padding: '8px',
    backgroundColor: '#F44336',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
  },
}

export default Products