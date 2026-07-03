import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

const BUCKET_NAME = 'qr-codes'

function PaymentSettings({ owner }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [qrFile, setQrFile] = useState(null)
  const [qrPreview, setQrPreview] = useState(null)
  const [form, setForm] = useState({
    cod_enabled: true,
    upi_enabled: false,
    upi_id: '',
    qr_code_url: '',
    minimum_cod_amount: 0,
    default_payment: 'cod',
    payment_instructions: '',
  })

  useEffect(() => {
    if (owner?.id) fetchSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner])

  async function fetchSettings() {
    try {
      setLoading(true)
      const { data } = await supabase
        .from('store_payment_settings')
        .select('*')
        .eq('store_id', owner.id)
        .maybeSingle()

      if (data) {
        setForm({
          cod_enabled: data.cod_enabled ?? true,
          upi_enabled: data.upi_enabled ?? false,
          upi_id: data.upi_id || '',
          qr_code_url: data.qr_code_url || '',
          minimum_cod_amount: data.minimum_cod_amount || 0,
          default_payment: data.default_payment || 'cod',
          payment_instructions: data.payment_instructions || '',
        })
      }
    } catch (err) {
      console.error('❌ fetchSettings error:', err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleQRFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setQrFile(file)
    const localUrl = URL.createObjectURL(file)
    setQrPreview(localUrl)
    setResult(null)
  }

  // ✅ FIXED save function with all logs and correct flow
  async function handleSave() {
    try {
      setSaving(true)
      setResult(null)

      // ✅ Step A — start with existing QR URL
      let finalQrUrl = form.qr_code_url || null
      console.log("QR FILE:", qrFile)
      console.log("Starting finalQrUrl:", finalQrUrl)

      // ✅ Step B — if new QR file selected, upload it
      if (qrFile) {
        const fileExt = qrFile.name.split('.').pop()
        const fileName = `${owner.id}-${Date.now()}.${fileExt}`
        const filePath = `qr/${fileName}`

        console.log("🔄 Uploading QR to path:", filePath)

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, qrFile, { upsert: true })

        // ✅ Log B
        console.log("UPLOAD RESULT:", uploadData, uploadError)

        if (uploadError) {
          console.error("❌ QR upload error:", uploadError.message)
          setResult({ type: 'error', message: `❌ QR upload failed: ${uploadError.message}` })
          setSaving(false)
          return
        }

        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath)

        finalQrUrl = publicUrlData?.publicUrl || null

        // ✅ Log C
        console.log("QR PUBLIC URL:", finalQrUrl)

        if (!finalQrUrl) {
          setResult({ type: 'error', message: '❌ Could not get QR public URL. Please try again.' })
          setSaving(false)
          return
        }
      }

      // ✅ Log D — before save
      console.log("SAVING PAYMENT SETTINGS WITH QR:", finalQrUrl)

      // ✅ Step C — upsert payment settings with finalQrUrl always included
      const { error: saveError } = await supabase
        .from('store_payment_settings')
        .upsert({
          store_id: owner.id,
          cod_enabled: form.cod_enabled,
          upi_enabled: form.upi_enabled,
          upi_id: form.upi_id,
          minimum_cod_amount: form.minimum_cod_amount,
          default_payment: form.default_payment,
          payment_instructions: form.payment_instructions,
          qr_code_url: finalQrUrl,   // ✅ always included — never missing
          updated_at: new Date().toISOString()
        }, { onConflict: 'store_id' })

      if (saveError) {
        console.error("SAVE PAYMENT SETTINGS ERROR:", saveError)
        setResult({ type: 'error', message: `❌ Save failed: ${saveError.message}` })
        return
      }

      // ✅ Update local form with new QR URL + clear file state
      setForm(prev => ({ ...prev, qr_code_url: finalQrUrl || '' }))
      setQrFile(null)
      setQrPreview(null)

      setResult({ type: 'success', message: '✅ Payment settings saved successfully!' })
      console.log("✅ Payment settings saved — qr_code_url:", finalQrUrl)

    } catch (err) {
      console.error("❌ handleSave error:", err.message)
      setResult({ type: 'error', message: `❌ Error: ${err.message}` })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={styles.center}>
        <p style={styles.loadingText}>⏳ Loading payment settings...</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>

      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>💳 Payment Settings</h2>
        <p style={styles.subtitle}>Configure payment methods for your store</p>
      </div>

      {/* Result */}
      {result && (
        <div style={{
          ...styles.resultBox,
          backgroundColor: result.type === 'success' ? '#e8f5e9' : '#ffebee',
          border: result.type === 'success' ? '1px solid #a5d6a7' : '1px solid #ffcdd2',
          color: result.type === 'success' ? '#2e7d32' : '#c62828',
        }}>
          {result.message}
        </div>
      )}

      {/* COD Section */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>💵 Cash on Delivery (COD)</h3>

        <div style={styles.toggleRow}>
          <div>
            <p style={styles.toggleLabel}>Enable COD</p>
            <p style={styles.toggleDesc}>Allow customers to pay cash on delivery</p>
          </div>
          <div
            style={{
              ...styles.toggle,
              backgroundColor: form.cod_enabled ? '#4CAF50' : '#ccc',
            }}
            onClick={() => setForm(prev => ({ ...prev, cod_enabled: !prev.cod_enabled }))}
          >
            <div style={{
              ...styles.toggleDot,
              transform: form.cod_enabled ? 'translateX(24px)' : 'translateX(2px)',
            }} />
          </div>
        </div>

        {form.cod_enabled && (
          <div style={styles.formField}>
            <label style={styles.label}>💰 Minimum Order Amount for COD (₹)</label>
            <input
              style={styles.input}
              type="number"
              min="0"
              placeholder="e.g. 500 (0 = no minimum)"
              value={form.minimum_cod_amount}
              onChange={(e) => setForm(prev => ({ ...prev, minimum_cod_amount: Number(e.target.value) }))}
            />
            <p style={styles.hint}>Set 0 for no minimum amount</p>
          </div>
        )}
      </div>

      {/* UPI Section */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>📱 UPI Payment</h3>

        <div style={styles.toggleRow}>
          <div>
            <p style={styles.toggleLabel}>Enable UPI</p>
            <p style={styles.toggleDesc}>Allow customers to pay via UPI</p>
          </div>
          <div
            style={{
              ...styles.toggle,
              backgroundColor: form.upi_enabled ? '#4CAF50' : '#ccc',
            }}
            onClick={() => setForm(prev => ({ ...prev, upi_enabled: !prev.upi_enabled }))}
          >
            <div style={{
              ...styles.toggleDot,
              transform: form.upi_enabled ? 'translateX(24px)' : 'translateX(2px)',
            }} />
          </div>
        </div>

        {form.upi_enabled && (
          <>
            <div style={styles.formField}>
              <label style={styles.label}>🔗 UPI ID</label>
              <input
                style={styles.input}
                type="text"
                placeholder="e.g. yourstore@oksbi"
                value={form.upi_id}
                onChange={(e) => setForm(prev => ({ ...prev, upi_id: e.target.value }))}
              />
            </div>

            <div style={styles.formField}>
              <label style={styles.label}>🖼️ QR Code</label>
              <input
                style={styles.fileInput}
                type="file"
                accept="image/*"
                onChange={handleQRFileSelect}
              />
              <p style={styles.hint}>
                Select a QR image and click Save to upload it.
              </p>

              {/* ✅ Show local preview of newly selected file */}
              {qrPreview && (
                <div style={styles.qrPreview}>
                  <p style={{ ...styles.hint, color: '#FF9800' }}>
                    🔄 New QR selected — click Save to upload
                  </p>
                  <img
                    src={qrPreview}
                    alt="New QR Code Preview"
                    style={styles.qrImage}
                  />
                </div>
              )}

              {/* ✅ Show existing saved QR if no new file selected */}
              {!qrPreview && form.qr_code_url && (
                <div style={styles.qrPreview}>
                  <p style={{ ...styles.hint, color: '#4CAF50' }}>✅ Current saved QR Code:</p>
                  <img
                    src={form.qr_code_url}
                    alt="Saved QR Code"
                    style={styles.qrImage}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Default Payment */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>⭐ Default Payment Method</h3>
        <p style={styles.sectionDesc}>Which payment method is shown first to customers?</p>

        <div style={styles.optionGrid}>
          {[
            { value: 'cod', label: '💵 Cash on Delivery', disabled: !form.cod_enabled },
            { value: 'upi', label: '📱 UPI Payment',      disabled: !form.upi_enabled },
          ].map((opt) => (
            <div
              key={opt.value}
              style={{
                ...styles.optionCard,
                backgroundColor: form.default_payment === opt.value ? '#e8f5e9' : '#fff',
                border: form.default_payment === opt.value ? '2px solid #4CAF50' : '2px solid #eee',
                opacity: opt.disabled ? 0.4 : 1,
                cursor: opt.disabled ? 'not-allowed' : 'pointer',
              }}
              onClick={() => {
                if (!opt.disabled) setForm(prev => ({ ...prev, default_payment: opt.value }))
              }}
            >
              <p style={styles.optionLabel}>{opt.label}</p>
              {opt.disabled && <p style={styles.optionDisabled}>Not enabled</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Payment Instructions */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>📝 Payment Instructions</h3>
        <p style={styles.sectionDesc}>Sent to customers after they choose a payment method</p>

        <textarea
          style={styles.textarea}
          placeholder="e.g. Please complete payment within 24 hours."
          value={form.payment_instructions}
          onChange={(e) => setForm(prev => ({ ...prev, payment_instructions: e.target.value }))}
          rows={4}
        />
      </div>

      {/* Save Button */}
      <button
        style={{
          ...styles.saveBtn,
          opacity: saving ? 0.7 : 1,
        }}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? '⏳ Saving...' : '💾 Save Payment Settings'}
      </button>

    </div>
  )
}

const styles = {
  container: { padding: '0' },
  center: { textAlign: 'center', padding: '60px' },
  loadingText: { fontSize: '18px', color: '#999' },
  header: {
    backgroundColor: '#fff',
    padding: '20px 24px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: '20px',
  },
  title: { margin: '0 0 4px', fontSize: '22px', color: '#333' },
  subtitle: { margin: 0, fontSize: '14px', color: '#999' },
  resultBox: {
    padding: '12px 16px', borderRadius: '8px',
    marginBottom: '16px', fontSize: '14px',
    fontWeight: 'bold', textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px 24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sectionTitle: { margin: 0, fontSize: '16px', color: '#333', fontWeight: 'bold' },
  sectionDesc: { margin: '-8px 0 0', fontSize: '13px', color: '#999' },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: { margin: '0 0 2px', fontSize: '14px', fontWeight: 'bold', color: '#333' },
  toggleDesc: { margin: 0, fontSize: '12px', color: '#999' },
  toggle: {
    width: '50px', height: '28px', borderRadius: '14px',
    cursor: 'pointer', position: 'relative',
    transition: 'background-color 0.2s', flexShrink: 0,
  },
  toggleDot: {
    width: '24px', height: '24px', borderRadius: '50%',
    backgroundColor: '#fff', position: 'absolute',
    top: '2px', transition: 'transform 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
  formField: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '14px', color: '#555', fontWeight: 'bold' },
  hint: { margin: '2px 0 0', fontSize: '12px', color: '#999' },
  input: {
    padding: '12px 16px', borderRadius: '8px',
    border: '1px solid #ddd', fontSize: '14px',
    outline: 'none', backgroundColor: '#fafafa',
  },
  fileInput: {
    padding: '8px', borderRadius: '8px',
    border: '1px solid #ddd', fontSize: '14px',
    backgroundColor: '#fafafa', cursor: 'pointer',
  },
  qrPreview: {
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  qrImage: {
    width: '150px', height: '150px',
    objectFit: 'contain', borderRadius: '8px',
    border: '1px solid #eee', padding: '8px',
    backgroundColor: '#fff',
  },
  optionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  optionCard: {
    padding: '16px', borderRadius: '8px',
    transition: 'all 0.2s',
  },
  optionLabel: { margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#333' },
  optionDisabled: { margin: '4px 0 0', fontSize: '12px', color: '#999' },
  textarea: {
    padding: '12px 16px', borderRadius: '8px',
    border: '1px solid #ddd', fontSize: '14px',
    outline: 'none', backgroundColor: '#fafafa',
    resize: 'vertical', fontFamily: 'Arial, sans-serif',
    width: '100%', boxSizing: 'border-box',
  },
  saveBtn: {
    width: '100%', padding: '14px',
    backgroundColor: '#4CAF50', color: '#fff',
    border: 'none', borderRadius: '8px',
    cursor: 'pointer', fontSize: '15px', fontWeight: 'bold',
    marginBottom: '20px',
  },
}

export default PaymentSettings