import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

function Offers({ owner }) {
  const [pastOffers, setPastOffers] = useState([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [customerCount, setCustomerCount] = useState(0)
  const [form, setForm] = useState({
    title: '',
    description: '',
    couponCode: '',
    imageUrl: '',
    audience: 'all'
  })

  useEffect(() => {
    fetchPastOffers()
    fetchCustomerCount('all')

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchPastOffers() {
    const { data } = await supabase
      .from('offers')
      .select('*')
      .eq('store_id', owner.id)
      .order('created_at', { ascending: false })
      .limit(10)

    setPastOffers(data || [])
  }

  async function fetchCustomerCount(audience) {
    const { data: orders } = await supabase
      .from('orders')
      .select('phone_number')
      .eq('store_id', owner.id)

    if (!orders) { setCustomerCount(0); return }

    const phoneCounts = {}
    orders.forEach(o => {
      phoneCounts[o.phone_number] = (phoneCounts[o.phone_number] || 0) + 1
    })

    const allPhones = Object.keys(phoneCounts)

    if (audience === 'all') {
      setCustomerCount(allPhones.length)
    } else if (audience === 'repeat') {
      setCustomerCount(allPhones.filter(p => phoneCounts[p] > 1).length)
    } else if (audience === 'new') {
      setCustomerCount(allPhones.filter(p => phoneCounts[p] === 1).length)
    } else if (audience === 'top') {
      setCustomerCount(Math.max(1, Math.ceil(allPhones.length * 0.2)))
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    if (name === 'audience') fetchCustomerCount(value)
  }

  async function handleSendOffer() {
    if (!form.title || !form.description) {
      alert('Please fill Title and Description')
      return
    }

    if (!window.confirm(`Send offer to ${customerCount} customers?`)) return

    try {
      setSending(true)
      setResult(null)

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/send-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: owner.id,
          title: form.title,
          description: form.description,
          couponCode: form.couponCode || null,
          imageUrl: form.imageUrl || null,
          audience: form.audience
        })
      })

      const data = await response.json()
      console.log("✅ Offer result:", data)

      setResult({
        type: 'success',
        message: `✅ Offer sent to ${data.sent} out of ${data.total} customers!`
      })

      // ✅ Reset form
      setForm({
        title: '',
        description: '',
        couponCode: '',
        imageUrl: '',
        audience: 'all'
      })

      fetchPastOffers()

    } catch (err) {
      console.error("❌ Send offer error:", err.message)
      setResult({
        type: 'error',
        message: `❌ Failed to send offer: ${err.message}`
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={styles.container}>

      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>🎁 Send Offers</h2>
      </div>

      {/* Result message */}
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

      {/* Form */}
      <div style={styles.formBox}>
        <h3 style={styles.formTitle}>📝 Create Offer</h3>

        {/* Title */}
        <div style={styles.formField}>
          <label style={styles.label}>🏷️ Offer Title *</label>
          <input
            style={styles.input}
            type="text"
            name="title"
            placeholder="e.g. Weekend Sale! 20% Off"
            value={form.title}
            onChange={handleChange}
          />
        </div>

        {/* Description */}
        <div style={styles.formField}>
          <label style={styles.label}>📝 Offer Description *</label>
          <textarea
            style={styles.textarea}
            name="description"
            placeholder="e.g. Get 20% off on all products this weekend only! Shop now and save big."
            value={form.description}
            onChange={handleChange}
            rows={4}
          />
        </div>

        {/* Coupon Code */}
        <div style={styles.formField}>
          <label style={styles.label}>🏷️ Coupon Code (optional)</label>
          <input
            style={styles.input}
            type="text"
            name="couponCode"
            placeholder="e.g. SAVE20"
            value={form.couponCode}
            onChange={handleChange}
          />
        </div>

        {/* Image URL */}
        <div style={styles.formField}>
          <label style={styles.label}>🖼️ Image URL (optional)</label>
          <input
            style={styles.input}
            type="text"
            name="imageUrl"
            placeholder="https://your-image-url.com/offer.jpg"
            value={form.imageUrl}
            onChange={handleChange}
          />
        </div>

        {/* Audience */}
        <div style={styles.formField}>
          <label style={styles.label}>👥 Select Audience</label>
          <div style={styles.audienceGrid}>
            {[
              { value: 'all',    label: '👥 All Customers',    desc: 'Everyone who ordered' },
              { value: 'repeat', label: '🔄 Repeat Customers', desc: 'Ordered more than once' },
              { value: 'new',    label: '🆕 New Customers',    desc: 'Ordered only once' },
              { value: 'top',    label: '⭐ Top Customers',    desc: 'Top 20% by orders' },
            ].map((option) => (
              <div
                key={option.value}
                style={{
                  ...styles.audienceOption,
                  backgroundColor: form.audience === option.value ? '#e8f5e9' : '#fff',
                  border: form.audience === option.value ? '2px solid #4CAF50' : '2px solid #eee',
                }}
                onClick={() => {
                  setForm({ ...form, audience: option.value })
                  fetchCustomerCount(option.value)
                }}
              >
                <p style={styles.audienceLabel}>{option.label}</p>
                <p style={styles.audienceDesc}>{option.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Customer count preview */}
        <div style={styles.previewBox}>
          <p style={styles.previewText}>
            📱 This offer will be sent to <strong>{customerCount} customer{customerCount !== 1 ? 's' : ''}</strong>
          </p>
        </div>

        {/* Preview */}
        {form.title && form.description && (
          <div style={styles.messagePreview}>
            <p style={styles.previewLabel}>👀 Message Preview:</p>
            <div style={styles.previewBubble}>
              <p style={{ margin: '0 0 8px', fontWeight: 'bold' }}>🎁 Special Offer from StyleFlow!</p>
              <p style={{ margin: '0 0 8px', fontWeight: 'bold' }}>{form.title}</p>
              <p style={{ margin: '0 0 8px' }}>{form.description}</p>
              {form.couponCode && (
                <p style={{ margin: '0 0 8px' }}>🏷️ Use coupon code: <strong>{form.couponCode}</strong></p>
              )}
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>🛍️ Shop now — just type a product name!</p>
            </div>
          </div>
        )}

        {/* Send Button */}
        <button
          style={{
            ...styles.sendBtn,
            opacity: sending ? 0.7 : 1
          }}
          onClick={handleSendOffer}
          disabled={sending}
        >
          {sending ? '⏳ Sending...' : `🚀 Send Offer to ${customerCount} Customers`}
        </button>

      </div>

      {/* Past Offers */}
      {pastOffers.length > 0 && (
        <div style={styles.pastOffersBox}>
          <h3 style={styles.pastOffersTitle}>📋 Past Offers</h3>
          {pastOffers.map((offer) => (
            <div key={offer.id} style={styles.pastOfferCard}>
              <div style={styles.pastOfferHeader}>
                <p style={styles.pastOfferTitle}>{offer.title}</p>
                <span style={styles.sentBadge}>
                  📱 Sent to {offer.sent_count}
                </span>
              </div>
              <p style={styles.pastOfferDesc}>{offer.description}</p>
              {offer.coupon_code && (
                <p style={styles.pastOfferCoupon}>🏷️ {offer.coupon_code}</p>
              )}
              <p style={styles.pastOfferMeta}>
                👥 {offer.audience} customers •{' '}
                {new Date(offer.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </p>
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
    backgroundColor: '#fff',
    padding: '16px 20px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: '20px',
  },
  title: { margin: 0, fontSize: '22px', color: '#333' },
  resultBox: {
    padding: '12px 16px', borderRadius: '8px',
    marginBottom: '16px', fontSize: '14px',
    fontWeight: 'bold', textAlign: 'center',
  },
  formBox: {
    backgroundColor: '#fff', borderRadius: '12px',
    padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: '20px', display: 'flex',
    flexDirection: 'column', gap: '20px',
  },
  formTitle: { margin: 0, fontSize: '18px', color: '#333' },
  formField: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '14px', color: '#555', fontWeight: 'bold' },
  input: {
    padding: '12px 16px', borderRadius: '8px',
    border: '1px solid #ddd', fontSize: '14px',
    outline: 'none', backgroundColor: '#fafafa',
  },
  textarea: {
    padding: '12px 16px', borderRadius: '8px',
    border: '1px solid #ddd', fontSize: '14px',
    outline: 'none', backgroundColor: '#fafafa',
    resize: 'vertical', fontFamily: 'Arial, sans-serif',
  },
  audienceGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  audienceOption: {
    padding: '12px 16px', borderRadius: '8px',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  audienceLabel: { margin: '0 0 4px', fontSize: '14px', fontWeight: 'bold', color: '#333' },
  audienceDesc: { margin: 0, fontSize: '12px', color: '#999' },
  previewBox: {
    backgroundColor: '#e8f5e9', borderRadius: '8px',
    padding: '12px 16px', textAlign: 'center',
  },
  previewText: { margin: 0, fontSize: '14px', color: '#2e7d32' },
  messagePreview: { display: 'flex', flexDirection: 'column', gap: '8px' },
  previewLabel: { margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#555' },
  previewBubble: {
    backgroundColor: '#e8f5e9', borderRadius: '12px',
    padding: '16px', fontSize: '14px',
    lineHeight: '1.6', color: '#333',
  },
  sendBtn: {
    padding: '14px', backgroundColor: '#4CAF50',
    color: '#fff', border: 'none', borderRadius: '8px',
    cursor: 'pointer', fontSize: '15px', fontWeight: 'bold',
  },
  pastOffersBox: {
    backgroundColor: '#fff', borderRadius: '12px',
    padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  pastOffersTitle: { margin: '0 0 16px', fontSize: '18px', color: '#333' },
  pastOfferCard: {
    borderBottom: '1px solid #f0f0f0',
    paddingBottom: '16px', marginBottom: '16px',
  },
  pastOfferHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '6px',
  },
  pastOfferTitle: { margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#333' },
  sentBadge: {
    backgroundColor: '#e8f5e9', color: '#2e7d32',
    padding: '4px 10px', borderRadius: '20px',
    fontSize: '12px', fontWeight: 'bold',
  },
  pastOfferDesc: { margin: '0 0 6px', fontSize: '13px', color: '#666' },
  pastOfferCoupon: { margin: '0 0 6px', fontSize: '13px', color: '#FF9800', fontWeight: 'bold' },
  pastOfferMeta: { margin: 0, fontSize: '12px', color: '#999' },
}

export default Offers