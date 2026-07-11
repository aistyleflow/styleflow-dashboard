import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

function Offers({ owner }) {
  const [pastOffers, setPastOffers] = useState([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [customerCount, setCustomerCount] = useState(0)
  const [form, setForm] = useState({
    title: '',
    description: '',
    couponCode: '',
    discountType: 'percentage',
    discountValue: '',
    minimumOrderAmount: '',
    startDate: '',
    endDate: '',
    imageUrl: '',
    audience: 'all'
  })
  const [showDiscount, setShowDiscount] = useState(false)

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
      .limit(20)
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

    if (audience === 'all') setCustomerCount(allPhones.length)
    else if (audience === 'repeat') setCustomerCount(allPhones.filter(p => phoneCounts[p] > 1).length)
    else if (audience === 'new') setCustomerCount(allPhones.filter(p => phoneCounts[p] === 1).length)
    else if (audience === 'top') setCustomerCount(Math.max(1, Math.ceil(allPhones.length * 0.2)))
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (name === 'audience') fetchCustomerCount(value)
    if (name === 'couponCode' && value.trim()) setShowDiscount(true)
    if (name === 'couponCode' && !value.trim()) setShowDiscount(false)
  }

  function isOfferActive(offer) {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    if (offer.start_date) {
      const start = new Date(offer.start_date)
      if (now < start) return 'upcoming'
    }
    if (offer.end_date) {
      const end = new Date(offer.end_date)
      end.setHours(23, 59, 59, 999)
      if (new Date() > end) return 'expired'
    }
    return 'active'
  }

  function formatOfferDate(dateStr) {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  function buildPreviewMessage() {
    let msg = `🎁 *Special Offer from ${owner.shop_name}!*\n\n`
    msg += `*${form.title || 'Your Offer Title'}*\n\n`
    msg += `${form.description || 'Your offer description here...'}\n`
    if (form.couponCode) {
      msg += `\n🏷️ Coupon Code: *${form.couponCode.toUpperCase()}*\n`
      if (form.discountType === 'percentage' && form.discountValue) {
        msg += `💸 Get *${form.discountValue}% OFF* on your order!\n`
      } else if (form.discountType === 'fixed' && form.discountValue) {
        msg += `💸 Get *₹${form.discountValue} OFF* on your order!\n`
      }
      if (form.minimumOrderAmount) {
        msg += `🛒 Min order: ₹${form.minimumOrderAmount}\n`
      }
    }
    if (form.startDate || form.endDate) {
      msg += `\n📅 Valid`
      if (form.startDate) msg += ` from ${formatOfferDate(form.startDate)}`
      if (form.endDate) msg += ` till ${formatOfferDate(form.endDate)}`
      msg += `\n`
    }
    msg += `\n🛍️ Shop now — just type a product name!\nHappy Shopping! 🎉`
    return msg
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

      const payload = {
        storeId: owner.id,
        title: form.title,
        description: form.description,
        couponCode: form.couponCode.toUpperCase() || null,
        discountType: form.couponCode ? form.discountType : null,
        discountValue: form.couponCode && form.discountValue ? Number(form.discountValue) : null,
        minimumOrderAmount: form.minimumOrderAmount ? Number(form.minimumOrderAmount) : 0,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        imageUrl: form.imageUrl || null,
        audience: form.audience
      }

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/send-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      setResult({
        type: 'success',
        message: `✅ Offer sent to ${data.sent} out of ${data.total} customers!`
      })

      setForm({
        title: '', description: '', couponCode: '', discountType: 'percentage',
        discountValue: '', minimumOrderAmount: '', startDate: '', endDate: '',
        imageUrl: '', audience: 'all'
      })
      setShowDiscount(false)
      fetchPastOffers()

    } catch (err) {
      setResult({ type: 'error', message: `❌ Failed to send: ${err.message}` })
    } finally {
      setSending(false)
    }
  }

  const statusConfig = {
    active:   { label: '🟢 Active',   bg: '#e8f5e9', color: '#2e7d32' },
    expired:  { label: '🔴 Expired',  bg: '#ffebee', color: '#c62828' },
    upcoming: { label: '🟡 Upcoming', bg: '#fff8e1', color: '#f57f17' },
  }

  return (
    <div style={styles.container}>

      <div style={styles.header}>
        <h2 style={styles.title}>🎁 Send Offers</h2>
        <p style={styles.subtitle}>Send promotional offers and coupon codes to your customers via WhatsApp</p>
      </div>

      {result && (
        <div style={{
          ...styles.resultBox,
          backgroundColor: result.type === 'success' ? '#e8f5e9' : '#ffebee',
          border: `1px solid ${result.type === 'success' ? '#a5d6a7' : '#ffcdd2'}`,
          color: result.type === 'success' ? '#2e7d32' : '#c62828',
        }}>
          {result.message}
        </div>
      )}

      <div style={styles.formBox}>
        <h3 style={styles.sectionTitle}>📝 Create Offer</h3>

        {/* Title */}
        <div style={styles.field}>
          <label style={styles.label}>🏷️ Offer Title <span style={styles.required}>*</span></label>
          <input style={styles.input} type="text" name="title"
            placeholder="e.g. Weekend Sale! 20% Off Everything"
            value={form.title} onChange={handleChange} />
        </div>

        {/* Description */}
        <div style={styles.field}>
          <label style={styles.label}>📝 Offer Description <span style={styles.required}>*</span></label>
          <textarea style={styles.textarea} name="description" rows={3}
            placeholder="e.g. Huge discounts this weekend only! Shop your favorite styles now."
            value={form.description} onChange={handleChange} />
        </div>

        {/* Date Range */}
        <div style={styles.field}>
          <label style={styles.label}>📅 Offer Validity (optional)</label>
          <div style={styles.dateRow}>
            <div style={styles.dateField}>
              <label style={styles.subLabel}>Start Date</label>
              <input style={styles.input} type="date" name="startDate"
                value={form.startDate} onChange={handleChange} />
            </div>
            <div style={styles.dateSep}>→</div>
            <div style={styles.dateField}>
              <label style={styles.subLabel}>End Date</label>
              <input style={styles.input} type="date" name="endDate"
                value={form.endDate} onChange={handleChange} />
            </div>
          </div>
          <p style={styles.hint}>If set, the offer will show validity dates in the WhatsApp message</p>
        </div>

        {/* Coupon Code */}
        <div style={styles.field}>
          <label style={styles.label}>🎟️ Coupon Code (optional)</label>
          <input style={styles.input} type="text" name="couponCode"
            placeholder="e.g. SAVE20 — customers type this in chat to apply discount"
            value={form.couponCode}
            onChange={e => {
              handleChange(e)
              setShowDiscount(!!e.target.value.trim())
            }} />
          <p style={styles.hint}>When customers type this code during checkout, the discount is automatically applied</p>
        </div>

        {/* Discount fields — shown only when coupon code is filled */}
        {showDiscount && (
          <div style={styles.discountBox}>
            <p style={styles.discountTitle}>💸 Discount Details</p>
            <div style={styles.discountRow}>
              <div style={styles.discountField}>
                <label style={styles.subLabel}>Discount Type</label>
                <select style={styles.select} name="discountType"
                  value={form.discountType} onChange={handleChange}>
                  <option value="percentage">Percentage (%) Off</option>
                  <option value="fixed">Fixed Amount (₹) Off</option>
                </select>
              </div>
              <div style={styles.discountField}>
                <label style={styles.subLabel}>
                  {form.discountType === 'percentage' ? 'Discount %' : 'Discount ₹'}
                </label>
                <input style={styles.input} type="number" name="discountValue"
                  placeholder={form.discountType === 'percentage' ? 'e.g. 20' : 'e.g. 100'}
                  value={form.discountValue} onChange={handleChange} min="0" />
              </div>
              <div style={styles.discountField}>
                <label style={styles.subLabel}>Min Order Amount (₹)</label>
                <input style={styles.input} type="number" name="minimumOrderAmount"
                  placeholder="e.g. 500 (optional)"
                  value={form.minimumOrderAmount} onChange={handleChange} min="0" />
              </div>
            </div>
          </div>
        )}

        {/* Audience */}
        <div style={styles.field}>
          <label style={styles.label}>👥 Select Audience</label>
          <div style={styles.audienceGrid}>
            {[
              { value: 'all',    label: '👥 All Customers',    desc: 'Everyone who ordered' },
              { value: 'repeat', label: '🔄 Repeat Customers', desc: 'Ordered more than once' },
              { value: 'new',    label: '🆕 New Customers',    desc: 'Ordered only once' },
              { value: 'top',    label: '⭐ Top Customers',    desc: 'Top 20% by order count' },
            ].map(opt => (
              <div key={opt.value}
                style={{
                  ...styles.audienceCard,
                  border: form.audience === opt.value ? '2px solid #4CAF50' : '2px solid #eee',
                  backgroundColor: form.audience === opt.value ? '#f1f8f1' : '#fff',
                }}
                onClick={() => { setForm(p => ({ ...p, audience: opt.value })); fetchCustomerCount(opt.value) }}>
                <p style={styles.audienceLabel}>{opt.label}</p>
                <p style={styles.audienceDesc}>{opt.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Reach count */}
        <div style={styles.reachBox}>
          <span style={styles.reachIcon}>📱</span>
          <p style={styles.reachText}>
            This offer will reach <strong>{customerCount} customer{customerCount !== 1 ? 's' : ''}</strong>
          </p>
        </div>

        {/* Preview */}
        {(form.title || form.description) && (
          <div style={styles.previewBox}>
            <p style={styles.previewLabel}>👁️ WhatsApp Message Preview</p>
            <div style={styles.previewBubble}>
              <pre style={styles.previewText}>{buildPreviewMessage()}</pre>
            </div>
          </div>
        )}

        {/* Send Button */}
        <button
          style={{ ...styles.sendBtn, opacity: sending ? 0.7 : 1 }}
          onClick={handleSendOffer}
          disabled={sending}>
          {sending ? '⏳ Sending...' : `🚀 Send to ${customerCount} Customer${customerCount !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Past Offers */}
      {pastOffers.length > 0 && (
        <div style={styles.pastBox}>
          <h3 style={styles.sectionTitle}>📋 Past Offers</h3>
          <div style={styles.pastList}>
            {pastOffers.map(offer => {
              const status = isOfferActive(offer)
              const sc = statusConfig[status]
              return (
                <div key={offer.id} style={styles.pastCard}>
                  <div style={styles.pastCardTop}>
                    <div style={styles.pastCardLeft}>
                      <p style={styles.pastCardTitle}>{offer.title}</p>
                      <p style={styles.pastCardDesc}>{offer.description}</p>
                    </div>
                    <div style={styles.pastCardRight}>
                      <span style={{ ...styles.statusBadge, backgroundColor: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                      <span style={styles.sentBadge}>📱 {offer.sent_count} sent</span>
                    </div>
                  </div>

                  <div style={styles.pastCardMeta}>
                    {offer.coupon_code && (
                      <span style={styles.couponTag}>
                        🏷️ {offer.coupon_code}
                        {offer.discount_type === 'percentage' && offer.discount_value
                          ? ` — ${offer.discount_value}% off`
                          : offer.discount_type === 'fixed' && offer.discount_value
                          ? ` — ₹${offer.discount_value} off`
                          : ''}
                        {offer.minimum_order_amount > 0 ? ` (min ₹${offer.minimum_order_amount})` : ''}
                      </span>
                    )}

                    {(offer.start_date || offer.end_date) && (
                      <span style={styles.dateTag}>
                        📅 {offer.start_date ? formatOfferDate(offer.start_date) : '—'}
                        {' → '}
                        {offer.end_date ? formatOfferDate(offer.end_date) : 'No end'}
                      </span>
                    )}

                    <span style={styles.audienceTag}>
                      👥 {offer.audience}
                    </span>

                    <span style={styles.createdTag}>
                      🕐 {new Date(offer.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { fontFamily: 'Arial, sans-serif', padding: '20px 0' },
  header: {
    backgroundColor: '#fff', padding: '20px 24px', borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px',
  },
  title: { margin: '0 0 4px', fontSize: '22px', color: '#333' },
  subtitle: { margin: 0, fontSize: '13px', color: '#999' },
  resultBox: {
    padding: '14px 16px', borderRadius: '10px', marginBottom: '16px',
    fontSize: '14px', fontWeight: 'bold', textAlign: 'center',
  },
  formBox: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px',
    display: 'flex', flexDirection: 'column', gap: '20px',
  },
  sectionTitle: { margin: 0, fontSize: '18px', color: '#333' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '14px', fontWeight: 'bold', color: '#444' },
  subLabel: { fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' },
  required: { color: '#f44336' },
  input: {
    padding: '11px 14px', borderRadius: '8px', border: '1px solid #ddd',
    fontSize: '14px', outline: 'none', backgroundColor: '#fafafa',
  },
  textarea: {
    padding: '11px 14px', borderRadius: '8px', border: '1px solid #ddd',
    fontSize: '14px', outline: 'none', backgroundColor: '#fafafa',
    resize: 'vertical', fontFamily: 'Arial, sans-serif',
  },
  select: {
    padding: '11px 14px', borderRadius: '8px', border: '1px solid #ddd',
    fontSize: '14px', outline: 'none', backgroundColor: '#fafafa', cursor: 'pointer',
  },
  hint: { margin: '2px 0 0', fontSize: '12px', color: '#aaa' },
  dateRow: { display: 'flex', gap: '12px', alignItems: 'center' },
  dateField: { flex: 1, display: 'flex', flexDirection: 'column' },
  dateSep: { fontSize: '18px', color: '#999', paddingTop: '20px' },
  discountBox: {
    backgroundColor: '#fff8e1', borderRadius: '10px', padding: '16px',
    border: '1px solid #ffe082',
  },
  discountTitle: { margin: '0 0 12px', fontSize: '14px', fontWeight: 'bold', color: '#f57f17' },
  discountRow: { display: 'flex', gap: '12px' },
  discountField: { flex: 1, display: 'flex', flexDirection: 'column' },
  audienceGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  audienceCard: {
    padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
    transition: 'all 0.2s',
  },
  audienceLabel: { margin: '0 0 2px', fontSize: '14px', fontWeight: 'bold', color: '#333' },
  audienceDesc: { margin: 0, fontSize: '12px', color: '#999' },
  reachBox: {
    backgroundColor: '#e8f5e9', borderRadius: '10px', padding: '12px 16px',
    display: 'flex', alignItems: 'center', gap: '10px',
  },
  reachIcon: { fontSize: '20px' },
  reachText: { margin: 0, fontSize: '14px', color: '#2e7d32' },
  previewBox: { display: 'flex', flexDirection: 'column', gap: '8px' },
  previewLabel: { margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#555' },
  previewBubble: {
    backgroundColor: '#e8f5e9', borderRadius: '12px 12px 12px 0',
    padding: '16px', border: '1px solid #c8e6c9',
  },
  previewText: {
    margin: 0, fontSize: '13px', lineHeight: '1.7', color: '#333',
    fontFamily: 'Arial, sans-serif', whiteSpace: 'pre-wrap',
  },
  sendBtn: {
    padding: '14px', backgroundColor: '#4CAF50', color: '#fff',
    border: 'none', borderRadius: '10px', cursor: 'pointer',
    fontSize: '15px', fontWeight: 'bold',
  },
  pastBox: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  pastList: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' },
  pastCard: {
    border: '1px solid #f0f0f0', borderRadius: '10px', padding: '16px',
  },
  pastCardTop: { display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' },
  pastCardLeft: { flex: 1 },
  pastCardRight: { display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' },
  pastCardTitle: { margin: '0 0 4px', fontSize: '15px', fontWeight: 'bold', color: '#333' },
  pastCardDesc: { margin: 0, fontSize: '13px', color: '#777' },
  statusBadge: {
    padding: '3px 10px', borderRadius: '20px', fontSize: '12px',
    fontWeight: 'bold', whiteSpace: 'nowrap',
  },
  sentBadge: {
    fontSize: '12px', color: '#4CAF50', fontWeight: 'bold',
  },
  pastCardMeta: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  couponTag: {
    backgroundColor: '#fff3e0', color: '#e65100', padding: '3px 10px',
    borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
  },
  dateTag: {
    backgroundColor: '#e3f2fd', color: '#1565c0', padding: '3px 10px',
    borderRadius: '20px', fontSize: '12px',
  },
  audienceTag: {
    backgroundColor: '#f3e5f5', color: '#6a1b9a', padding: '3px 10px',
    borderRadius: '20px', fontSize: '12px',
  },
  createdTag: {
    backgroundColor: '#f5f5f5', color: '#757575', padding: '3px 10px',
    borderRadius: '20px', fontSize: '12px',
  },
}

export default Offers