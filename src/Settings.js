import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

function Settings({ owner }) {
  const [form, setForm] = useState({
    shop_name: '',
    phone_number: '',
    address: '',
    instagram: '',
    description: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('shop_owners')
        .select('*')
        .eq('id', owner.id)
        .maybeSingle()

      if (error) {
        setError(error.message)
        return
      }

      if (data) {
        setForm({
          shop_name:    data.shop_name    || '',
          phone_number: data.phone_number || '',
          address:      data.address      || '',
          instagram:    data.instagram    || '',
          description:  data.description  || ''
        })
      }

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSave() {
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      const { error } = await supabase
        .from('shop_owners')
        .update({
          shop_name:   form.shop_name,
          address:     form.address,
          instagram:   form.instagram,
          description: form.description
        })
        .eq('id', owner.id)

      if (error) {
        setError(error.message)
        return
      }

      setSuccess(true)
      console.log('✅ Settings saved')
      setTimeout(() => setSuccess(false), 3000)

    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={styles.center}>
        <p style={styles.loadingText}>⏳ Loading settings...</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>

      <div style={styles.header}>
        <h2 style={styles.title}>⚙️ Store Settings</h2>
      </div>

      {/* ✅ Success message */}
      {success && (
        <div style={styles.successBox}>
          ✅ Settings saved successfully!
        </div>
      )}

      {/* ✅ Error message */}
      {error && (
        <div style={styles.errorBox}>
          ❌ Error: {error}
        </div>
      )}

      <div style={styles.formBox}>

        {/* Store Name */}
        <div style={styles.formField}>
          <label style={styles.label}>🏪 Store Name</label>
          <input
            style={styles.input}
            type="text"
            name="shop_name"
            placeholder="Enter your store name"
            value={form.shop_name}
            onChange={handleChange}
          />
        </div>

        {/* WhatsApp Number — read only */}
        <div style={styles.formField}>
          <label style={styles.label}>📱 WhatsApp Number</label>
          <input
            style={{ ...styles.input, backgroundColor: '#f0f0f0', color: '#999' }}
            type="text"
            name="phone_number"
            value={form.phone_number}
            readOnly
          />
          <p style={styles.hint}>Phone number cannot be changed</p>
        </div>

        {/* Address */}
        <div style={styles.formField}>
          <label style={styles.label}>📍 Store Address</label>
          <input
            style={styles.input}
            type="text"
            name="address"
            placeholder="Enter your store address"
            value={form.address}
            onChange={handleChange}
          />
        </div>

        {/* Instagram */}
        <div style={styles.formField}>
          <label style={styles.label}>📸 Instagram</label>
          <input
            style={styles.input}
            type="text"
            name="instagram"
            placeholder="e.g. @yourstorename"
            value={form.instagram}
            onChange={handleChange}
          />
        </div>

        {/* Description */}
        <div style={styles.formField}>
          <label style={styles.label}>📝 Store Description</label>
          <textarea
            style={styles.textarea}
            name="description"
            placeholder="Describe your store..."
            value={form.description}
            onChange={handleChange}
            rows={4}
          />
        </div>

        {/* Save Button */}
        <button
          style={{
            ...styles.saveBtn,
            opacity: saving ? 0.7 : 1
          }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '⏳ Saving...' : '💾 Save Settings'}
        </button>

      </div>

    </div>
  )
}

const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    padding: '20px 0',
  },
  header: {
    backgroundColor: '#fff',
    padding: '16px 20px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: '20px',
  },
  title: {
    margin: 0,
    fontSize: '22px',
    color: '#333',
  },
  successBox: {
    backgroundColor: '#e8f5e9',
    border: '1px solid #a5d6a7',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
    color: '#2e7d32',
    fontSize: '14px',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#ffebee',
    border: '1px solid #ffcdd2',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
    color: '#c62828',
    fontSize: '14px',
    textAlign: 'center',
  },
  formBox: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    color: '#555',
    fontWeight: 'bold',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#fafafa',
  },
  textarea: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#fafafa',
    resize: 'vertical',
    fontFamily: 'Arial, sans-serif',
  },
  hint: {
    margin: '4px 0 0',
    fontSize: '12px',
    color: '#999',
  },
  saveBtn: {
    padding: '14px',
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 'bold',
    marginTop: '8px',
  },
  center: {
    textAlign: 'center',
    padding: '60px',
  },
  loadingText: {
    fontSize: '18px',
    color: '#999',
  },
}

export default Settings
