import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

function Customers({ owner }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  useEffect(() => {
    if (owner?.id) fetchCustomers()
  }, [owner])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('store_id', Number(owner.id))
        .order('created_at', { ascending: false })

      if (error) { setError(error.message); return }

      // Group orders by phone number → build CRM customer list
      const customerMap = {}
      ;(data || []).forEach((order) => {
        const key = order.phone_number
        if (!customerMap[key]) {
          customerMap[key] = {
            phone_number: order.phone_number,
            customer_name: order.customer_name || 'N/A',
            customer_address: order.customer_address || 'N/A',
            orders: [],
            total_spent: 0,
          }
        }
        customerMap[key].orders.push(order)
        customerMap[key].total_spent += Number(order.total_amount || 0)
      })

      const list = Object.values(customerMap).sort(
        (a, b) => b.orders.length - a.orders.length
      )
      setCustomers(list)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'pending':   return '#FFA500'
      case 'confirmed': return '#2196F3'
      case 'shipped':   return '#9C27B0'
      case 'delivered': return '#4CAF50'
      case 'cancelled': return '#F44336'
      default:          return '#999'
    }
  }

  const filtered = customers.filter((c) =>
    c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone_number.includes(search)
  )

  // ─── Order History Modal ───────────────────────────────────────────────────
  if (selectedCustomer) {
    return (
      <div style={styles.container}>
        <div style={styles.modalHeader}>
          <button style={styles.backBtn} onClick={() => setSelectedCustomer(null)}>
            ← Back to Customers
          </button>
          <h2 style={styles.modalTitle}>
            👤 {selectedCustomer.customer_name}
          </h2>
          <p style={styles.modalSub}>📱 {selectedCustomer.phone_number}</p>
          <p style={styles.modalSub}>📍 {selectedCustomer.customer_address}</p>
        </div>

        <h3 style={styles.sectionTitle}>🧾 Order History ({selectedCustomer.orders.length})</h3>
        <div style={styles.ordersList}>
          {selectedCustomer.orders.map((order) => (
            <div key={order.id} style={styles.orderCard}>
              <div style={styles.orderRow}>
                <span style={styles.orderId}>🆔 {order.id}</span>
                <span style={{
                  ...styles.statusBadge,
                  backgroundColor: getStatusColor(order.status)
                }}>
                  {order.status.toUpperCase()}
                </span>
              </div>
              <p style={styles.orderDate}>
                🕐 {new Date(order.created_at).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit', hour12: true,
                })}
              </p>
              {order.total_amount && (
                <p style={styles.orderAmount}>💰 ₹{Number(order.total_amount).toLocaleString('en-IN')}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Main CRM List ─────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>

      {/* Stats */}
      <div style={styles.statsBar}>
        <div style={styles.statCard}>
          <span style={{ ...styles.statNumber, color: '#333' }}>{customers.length}</span>
          <span style={styles.statLabel}>Total Customers</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statNumber, color: '#4CAF50' }}>
            {customers.filter(c => c.orders.length > 1).length}
          </span>
          <span style={styles.statLabel}>🔁 Repeat Customers</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statNumber, color: '#2196F3' }}>
            {customers.filter(c => c.orders.length === 1).length}
          </span>
          <span style={styles.statLabel}>🆕 New Customers</span>
        </div>
      </div>

      {/* Search */}
      <input
        style={styles.searchInput}
        placeholder="🔍 Search by name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <p style={styles.center}>⏳ Loading customers...</p>}
      {error   && <p style={{ color: 'red', textAlign: 'center' }}>❌ {error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p style={styles.center}>📭 No customers found.</p>
      )}

      {/* Customer Cards */}
      <div style={styles.grid}>
        {filtered.map((customer) => (
          <div key={customer.phone_number} style={styles.customerCard}>
            <div style={styles.avatarRow}>
              <div style={styles.avatar}>
                {customer.customer_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={styles.customerName}>{customer.customer_name}</p>
                <p style={styles.customerPhone}>📱 {customer.phone_number}</p>
              </div>
            </div>

            <p style={styles.customerAddress}>📍 {customer.customer_address}</p>

            <div style={styles.customerStats}>
              <div style={styles.miniStat}>
                <span style={styles.miniNum}>{customer.orders.length}</span>
                <span style={styles.miniLabel}>Orders</span>
              </div>
              {customer.total_spent > 0 && (
                <div style={styles.miniStat}>
                  <span style={{ ...styles.miniNum, color: '#4CAF50' }}>
                    ₹{Number(customer.total_spent).toLocaleString('en-IN')}
                  </span>
                  <span style={styles.miniLabel}>Total Spent</span>
                </div>
              )}
              <div style={styles.miniStat}>
                <span style={styles.miniNum}>
                  {customer.orders.length > 1 ? '🔁 Repeat' : '🆕 New'}
                </span>
              </div>
            </div>

            <p style={styles.lastOrder}>
              🕐 Last order: {new Date(customer.orders[0].created_at).toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric'
              })}
            </p>

            <button
              style={styles.viewBtn}
              onClick={() => setSelectedCustomer(customer)}
            >
              View Order History →
            </button>
          </div>
        ))}
      </div>

    </div>
  )
}

const styles = {
  container: { padding: '0' },
  statsBar: { display: 'flex', gap: '12px', marginBottom: '20px' },
  statCard: {
    flex: 1, backgroundColor: '#fff', padding: '16px',
    borderRadius: '12px', textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    display: 'flex', flexDirection: 'column', gap: '4px',
  },
  statNumber: { fontSize: '26px', fontWeight: 'bold' },
  statLabel: { fontSize: '12px', color: '#999' },
  searchInput: {
    width: '100%', padding: '12px 16px', fontSize: '14px',
    borderRadius: '10px', border: '1px solid #ddd',
    marginBottom: '20px', boxSizing: 'border-box',
    outline: 'none',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  customerCard: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  avatarRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  avatar: {
    width: '44px', height: '44px', borderRadius: '50%',
    backgroundColor: '#4CAF50', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '20px', fontWeight: 'bold', flexShrink: 0,
  },
  customerName: { margin: 0, fontWeight: 'bold', fontSize: '15px', color: '#333' },
  customerPhone: { margin: '2px 0 0', fontSize: '13px', color: '#666' },
  customerAddress: { margin: 0, fontSize: '12px', color: '#999' },
  customerStats: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  miniStat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  miniNum: { fontWeight: 'bold', fontSize: '14px', color: '#333' },
  miniLabel: { fontSize: '11px', color: '#999' },
  lastOrder: { margin: 0, fontSize: '12px', color: '#aaa' },
  viewBtn: {
    padding: '8px 16px', backgroundColor: '#4CAF50', color: '#fff',
    border: 'none', borderRadius: '8px', cursor: 'pointer',
    fontSize: '13px', fontWeight: 'bold', marginTop: '4px',
  },
  // Modal styles
  modalHeader: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px',
  },
  backBtn: {
    padding: '8px 16px', backgroundColor: '#f0f0f0', color: '#333',
    border: 'none', borderRadius: '8px', cursor: 'pointer',
    fontSize: '13px', marginBottom: '12px',
  },
  modalTitle: { margin: '0 0 4px', fontSize: '20px', color: '#333' },
  modalSub: { margin: '4px 0 0', fontSize: '14px', color: '#666' },
  sectionTitle: { margin: '0 0 12px', fontSize: '16px', color: '#333' },
  ordersList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  orderCard: {
    backgroundColor: '#fff', borderRadius: '10px', padding: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  orderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
  orderId: { fontSize: '13px', color: '#999', fontFamily: 'monospace' },
  statusBadge: {
    padding: '4px 12px', borderRadius: '20px', color: '#fff',
    fontSize: '12px', fontWeight: 'bold',
  },
  orderDate: { margin: '4px 0', fontSize: '13px', color: '#999' },
  orderAmount: { margin: '4px 0 0', fontSize: '14px', fontWeight: 'bold', color: '#4CAF50' },
  center: { textAlign: 'center', padding: '40px', color: '#999', fontSize: '16px' },
}

export default Customers