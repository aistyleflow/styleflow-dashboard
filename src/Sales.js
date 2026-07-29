import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
  })
}

function formatDateTime(dateString) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
  })
}

function getOrderAmount(order) {
  return Number(order.payment_amount || order.total_amount || order.order_total || order.total || 0)
}

function getDateRange(filter) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (filter) {
    case 'today':
      return { start: today, end: new Date(today.getTime() + 86400000) }
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1)
      return { start: y, end: today }
    }
    case '7days': {
      const s = new Date(today); s.setDate(s.getDate() - 6)
      return { start: s, end: new Date(today.getTime() + 86400000) }
    }
    case '30days': {
      const s = new Date(today); s.setDate(s.getDate() - 29)
      return { start: s, end: new Date(today.getTime() + 86400000) }
    }
    case '90days': {
      const s = new Date(today); s.setDate(s.getDate() - 89)
      return { start: s, end: new Date(today.getTime() + 86400000) }
    }
    case 'thisMonth': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: s, end: new Date(today.getTime() + 86400000) }
    }
    case 'lastMonth': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: s, end: e }
    }
    case 'thisYear': {
      const s = new Date(now.getFullYear(), 0, 1)
      return { start: s, end: new Date(today.getTime() + 86400000) }
    }
    default:
      return null
  }
}

function exportCSV(data, filename) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function exportExcel(data, filename) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(row => headers.map(h => row[h] ?? ''))
  let xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Sales"><Table>`
  xml += `<Row>${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>`
  rows.forEach(row => {
    xml += `<Row>${row.map(v => `<Cell><Data ss:Type="String">${v}</Data></Cell>`).join('')}</Row>`
  })
  xml += `</Table></Worksheet></Workbook>`
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Simple Bar Chart ────────────────────────────────────────────────────────

function BarChart({ data, color = '#4CAF50' }) {
  if (!data || data.length === 0) return <div style={styles.emptyChart}>No data</div>
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px', padding: '8px 0' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{
            width: '100%', backgroundColor: color, borderRadius: '3px 3px 0 0',
            height: `${Math.max((d.value / max) * 100, 2)}%`,
            transition: 'height 0.3s ease', minHeight: '2px'
          }} title={`${d.label}: ${d.value}`} />
          <span style={{ fontSize: '9px', color: '#999', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Simple Line Chart ───────────────────────────────────────────────────────

function LineChart({ data, color = '#2196F3' }) {
  if (!data || data.length === 0) return <div style={styles.emptyChart}>No data</div>
  const max = Math.max(...data.map(d => d.value), 1)
  const width = 500; const height = 120; const pad = 20
  const points = data.map((d, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (width - pad * 2)
    const y = height - pad - ((d.value / max) * (height - pad * 2))
    return `${x},${y}`
  }).join(' ')

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '130px' }}>
        <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
        {data.map((d, i) => {
          const x = pad + (i / Math.max(data.length - 1, 1)) * (width - pad * 2)
          const y = height - pad - ((d.value / max) * (height - pad * 2))
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3" fill={color} />
              <title>{d.label}: ₹{d.value}</title>
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
        {data.filter((_, i) => i === 0 || i === data.length - 1 || data.length <= 7 || i % Math.ceil(data.length / 6) === 0).map((d, i) => (
          <span key={i} style={{ fontSize: '10px', color: '#999' }}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Pie Chart ───────────────────────────────────────────────────────────────

function PieChart({ data }) {
  if (!data || data.length === 0) return <div style={styles.emptyChart}>No data</div>
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div style={styles.emptyChart}>No data</div>
  let cumulative = 0
  const colors = ['#FFA500', '#2196F3', '#9C27B0', '#4CAF50', '#F44336', '#FF9800']
  const slices = data.map((d, i) => {
    const pct = d.value / total
    const start = cumulative; cumulative += pct
    const startAngle = start * 2 * Math.PI - Math.PI / 2
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2
    const x1 = 50 + 45 * Math.cos(startAngle)
    const y1 = 50 + 45 * Math.sin(startAngle)
    const x2 = 50 + 45 * Math.cos(endAngle)
    const y2 = 50 + 45 * Math.sin(endAngle)
    const large = pct > 0.5 ? 1 : 0
    return { ...d, path: `M50,50 L${x1},${y1} A45,45 0 ${large},1 ${x2},${y2} Z`, color: colors[i % colors.length], pct: Math.round(pct * 100) }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 100 100" style={{ width: '140px', height: '140px', flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="0.5">
            <title>{s.label}: {s.value} ({s.pct}%)</title>
          </path>
        ))}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: s.color, flexShrink: 0 }} />
            <span style={{ color: '#555' }}>{s.label}: <strong>{s.value}</strong> ({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = '20px', style = {} }) {
  return (
    <div style={{
      width, height, backgroundColor: '#e0e0e0', borderRadius: '4px',
      animation: 'pulse 1.5s ease-in-out infinite', ...style
    }} />
  )
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, icon, color = '#4CAF50', loading }) {
  return (
    <div style={styles.metricCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={styles.metricLabel}>{label}</p>
          {loading
            ? <Skeleton height="32px" width="80px" style={{ marginTop: '8px' }} />
            : <p style={{ ...styles.metricValue, color }}>{value}</p>
          }
        </div>
        <span style={{ fontSize: '28px' }}>{icon}</span>
      </div>
    </div>
  )
}

// ─── Main Sales Component ─────────────────────────────────────────────────────

function Sales({ owner }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [chartTab, setChartTab] = useState('revenue')
  const [chartRange, setChartRange] = useState('30days')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [activeFilter, setActiveFilter] = useState('30days')
  const [orderItems, setOrderItems] = useState({})

  // ─── Fetch Orders ──────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    if (!owner?.id) return
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('store_id', Number(owner.id))
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])

      // Fetch order items for best sellers
      if (data && data.length > 0) {
        const orderIds = data.map(o => o.id)
        const { data: items } = await supabase
          .from('order_items')
          .select('order_id, product_id, quantity, product_name, price')
          .in('order_id', orderIds)
        setOrderItems(items || [])
      }

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [owner?.id])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // ─── Filter orders by date range ──────────────────────────────────────────

  const filteredOrders = useMemo(() => {
    let result = [...orders]

    // Date filter
    if (activeFilter === 'custom' && customStart && customEnd) {
      const start = new Date(customStart)
      const end = new Date(customEnd); end.setHours(23, 59, 59)
      result = result.filter(o => {
        const d = new Date(o.created_at)
        return d >= start && d <= end
      })
    } else if (activeFilter !== 'all') {
      const range = getDateRange(activeFilter)
      if (range) {
        result = result.filter(o => {
          const d = new Date(o.created_at)
          return d >= range.start && d < range.end
        })
      }
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(o =>
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.phone_number || '').includes(q) ||
        String(o.store_order_number || o.id).includes(q)
      )
    }

    return result
  }, [orders, activeFilter, customStart, customEnd, search])

  // ─── Core Metrics ─────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const delivered = orders.filter(o => o.status === 'delivered')
    const totalRevenue = delivered.reduce((s, o) => s + getOrderAmount(o), 0)

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayOrders = delivered.filter(o => new Date(o.created_at) >= todayStart)
    const todayRevenue = todayOrders.reduce((s, o) => s + getOrderAmount(o), 0)

    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 6)
    const weekRevenue = delivered
      .filter(o => new Date(o.created_at) >= weekStart)
      .reduce((s, o) => s + getOrderAmount(o), 0)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthRevenue = delivered
      .filter(o => new Date(o.created_at) >= monthStart)
      .reduce((s, o) => s + getOrderAmount(o), 0)

    const totalOrders = orders.length
    const pending = orders.filter(o => o.status === 'pending').length
    const confirmed = orders.filter(o => o.status === 'confirmed').length
    const shipped = orders.filter(o => o.status === 'shipped').length
    const deliveredCount = orders.filter(o => o.status === 'delivered').length
    const cancelled = orders.filter(o => o.status === 'cancelled').length

    const avgOrder = deliveredCount > 0 ? Math.round(totalRevenue / deliveredCount) : 0

    const phones = [...new Set(orders.map(o => o.phone_number).filter(Boolean))]
    const totalCustomers = phones.length

    const phoneCounts = {}
    orders.forEach(o => { if (o.phone_number) phoneCounts[o.phone_number] = (phoneCounts[o.phone_number] || 0) + 1 })
    const repeatCustomers = Object.values(phoneCounts).filter(c => c > 1).length

    return {
      totalRevenue, todayRevenue, weekRevenue, monthRevenue,
      totalOrders, pending, confirmed, shipped, deliveredCount, cancelled,
      avgOrder, totalCustomers, repeatCustomers
    }
  }, [orders])

  // ─── Chart Data ───────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    const range = getDateRange(chartRange)
    const now = new Date()
    const filtered = range
      ? orders.filter(o => {
          const d = new Date(o.created_at)
          return d >= range.start && d < range.end
        })
      : orders

    const delivered = filtered.filter(o => o.status === 'delivered')

    if (chartRange === 'today') {
      // Hourly
      const hours = Array.from({ length: 24 }, (_, i) => ({ label: `${i}h`, value: 0 }))
      delivered.forEach(o => {
        const h = new Date(o.created_at).getHours()
        hours[h].value += getOrderAmount(o)
      })
      return { revenue: hours, orders: Array.from({ length: 24 }, (_, i) => ({
        label: `${i}h`,
        value: filtered.filter(o => new Date(o.created_at).getHours() === i).length
      }))}
    }

    if (chartRange === 'year') {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const rev = months.map(m => ({ label: m, value: 0 }))
      const ord = months.map(m => ({ label: m, value: 0 }))
      delivered.forEach(o => {
        const m = new Date(o.created_at).getMonth()
        rev[m].value += getOrderAmount(o)
      })
      filtered.forEach(o => {
        const m = new Date(o.created_at).getMonth()
        ord[m].value++
      })
      return { revenue: rev, orders: ord }
    }

    // Daily
    const days = chartRange === '7days' ? 7 : 30
    const revMap = {}; const ordMap = {}
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i)
      const key = `${d.getDate()}/${d.getMonth() + 1}`
      revMap[key] = 0; ordMap[key] = 0
    }

    delivered.forEach(o => {
      const d = new Date(o.created_at)
      const key = `${d.getDate()}/${d.getMonth() + 1}`
      if (key in revMap) revMap[key] += getOrderAmount(o)
    })
    filtered.forEach(o => {
      const d = new Date(o.created_at)
      const key = `${d.getDate()}/${d.getMonth() + 1}`
      if (key in ordMap) ordMap[key]++
    })

    return {
      revenue: Object.entries(revMap).map(([label, value]) => ({ label, value })),
      orders: Object.entries(ordMap).map(([label, value]) => ({ label, value }))
    }
  }, [orders, chartRange])

  // ─── Pie Chart Data ───────────────────────────────────────────────────────

  const pieData = useMemo(() => [
    { label: 'Pending',   value: orders.filter(o => o.status === 'pending').length },
    { label: 'Confirmed', value: orders.filter(o => o.status === 'confirmed').length },
    { label: 'Shipped',   value: orders.filter(o => o.status === 'shipped').length },
    { label: 'Delivered', value: orders.filter(o => o.status === 'delivered').length },
    { label: 'Cancelled', value: orders.filter(o => o.status === 'cancelled').length },
  ].filter(d => d.value > 0), [orders])

  // ─── Best Sellers ─────────────────────────────────────────────────────────

  const bestSellers = useMemo(() => {
    const map = {}
    const deliveredIds = new Set(
      orders.filter(o => o.status === 'delivered').map(o => o.id)
    )
    const itemsArray = Array.isArray(orderItems) ? orderItems : []
    itemsArray
      .filter(item => deliveredIds.has(item.order_id))
      .forEach(item => {
        const name = item.product_name || `Product #${item.product_id}`
        if (!map[name]) map[name] = { name, units: 0, revenue: 0 }
        map[name].units += item.quantity || 1
        map[name].revenue += (item.price || 0) * (item.quantity || 1)
      })
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((item, i) => ({ ...item, rank: i + 1 }))
  }, [orders, orderItems])

  // ─── Insights ─────────────────────────────────────────────────────────────

  const insights = useMemo(() => {
    const delivered = orders.filter(o => o.status === 'delivered')
    if (delivered.length === 0) return null

    const dayMap = {}; const monthMap = {}
    delivered.forEach(o => {
      const d = new Date(o.created_at)
      const dayKey = d.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' })
      const monthKey = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
      dayMap[dayKey] = (dayMap[dayKey] || 0) + getOrderAmount(o)
      monthMap[monthKey] = (monthMap[monthKey] || 0) + getOrderAmount(o)
    })

    const bestDay = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0]
    const bestMonth = Object.entries(monthMap).sort((a, b) => b[1] - a[1])[0]

    const amounts = delivered.map(o => getOrderAmount(o))
    const highest = Math.max(...amounts)
    const lowest = Math.min(...amounts.filter(a => a > 0))

    // Revenue growth: compare last 30 days vs previous 30 days
    const now = new Date()
    const last30Start = new Date(now); last30Start.setDate(last30Start.getDate() - 30)
    const prev30Start = new Date(now); prev30Start.setDate(prev30Start.getDate() - 60)

    const last30Rev = delivered
      .filter(o => new Date(o.created_at) >= last30Start)
      .reduce((s, o) => s + getOrderAmount(o), 0)
    const prev30Rev = delivered
      .filter(o => new Date(o.created_at) >= prev30Start && new Date(o.created_at) < last30Start)
      .reduce((s, o) => s + getOrderAmount(o), 0)

    const revenueGrowth = prev30Rev > 0
      ? Math.round(((last30Rev - prev30Rev) / prev30Rev) * 100)
      : last30Rev > 0 ? 100 : 0

    const last30Orders = orders.filter(o => new Date(o.created_at) >= last30Start).length
    const prev30Orders = orders.filter(o => new Date(o.created_at) >= prev30Start && new Date(o.created_at) < last30Start).length
    const orderGrowth = prev30Orders > 0
      ? Math.round(((last30Orders - prev30Orders) / prev30Orders) * 100)
      : last30Orders > 0 ? 100 : 0

    return { bestDay, bestMonth, highest, lowest, revenueGrowth, orderGrowth }
  }, [orders])

  // ─── Export Data ──────────────────────────────────────────────────────────

  function handleExportCSV() {
    const data = filteredOrders.map(o => ({
      'Order #': o.store_order_number || o.id,
      'Customer': o.customer_name || 'N/A',
      'Phone': o.phone_number || 'N/A',
      'Amount': getOrderAmount(o),
      'Status': o.status,
      'Payment Method': o.payment_method || 'N/A',
      'Payment Status': o.payment_status || 'N/A',
      'Date': formatDateTime(o.created_at),
    }))
    exportCSV(data, `styleflow-sales-${Date.now()}.csv`)
  }

  function handleExportExcel() {
    const data = filteredOrders.map(o => ({
      'Order #': o.store_order_number || o.id,
      'Customer': o.customer_name || 'N/A',
      'Phone': o.phone_number || 'N/A',
      'Amount': getOrderAmount(o),
      'Status': o.status,
      'Payment Method': o.payment_method || 'N/A',
      'Payment Status': o.payment_status || 'N/A',
      'Date': formatDateTime(o.created_at),
    }))
    exportExcel(data, `styleflow-sales-${Date.now()}.xls`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const statusColor = {
    pending: '#FFA500', confirmed: '#2196F3',
    shipped: '#9C27B0', delivered: '#4CAF50', cancelled: '#F44336'
  }

  if (error) return (
    <div style={styles.errorBox}>
      <p>❌ Error loading sales data: {error}</p>
      <button onClick={fetchOrders} style={styles.retryBtn}>🔄 Retry</button>
    </div>
  )

  return (
    <div style={styles.container}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* ── Header ── */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>📊 Sales Analytics</h2>
          <p style={styles.subtitle}>{owner?.shop_name} — Real-time dashboard</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchOrders} style={styles.refreshBtn}>🔄 Refresh</button>
          <button onClick={handleExportCSV} style={styles.exportBtn}>📄 CSV</button>
          <button onClick={handleExportExcel} style={styles.exportBtn}>📊 Excel</button>
        </div>
      </div>

      {/* ── Date Filter Bar ── */}
      <div style={styles.filterBar}>
        {[
          { key: 'today', label: 'Today' },
          { key: 'yesterday', label: 'Yesterday' },
          { key: '7days', label: '7 Days' },
          { key: '30days', label: '30 Days' },
          { key: '90days', label: '90 Days' },
          { key: 'thisMonth', label: 'This Month' },
          { key: 'lastMonth', label: 'Last Month' },
          { key: 'thisYear', label: 'This Year' },
          { key: 'all', label: 'All Time' },
          { key: 'custom', label: '📅 Custom' },
        ].map(f => (
          <button key={f.key} style={{
            ...styles.filterBtn,
            backgroundColor: activeFilter === f.key ? '#4CAF50' : '#f0f0f0',
            color: activeFilter === f.key ? '#fff' : '#333',
          }} onClick={() => setActiveFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Custom Date Range ── */}
      {activeFilter === 'custom' && (
        <div style={styles.customDateRow}>
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={styles.dateInput} />
          <span style={{ color: '#999' }}>→</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={styles.dateInput} />
        </div>
      )}

      {/* ── Search ── */}
      <input
        style={styles.searchInput}
        placeholder="🔍 Search by name, phone, or order number..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* ── Results count ── */}
      {!loading && (
        <p style={{ fontSize: '13px', color: '#999', marginBottom: '16px' }}>
          Showing {filteredOrders.length} of {orders.length} orders
        </p>
      )}

      {/* ── Metric Cards ── */}
      <div style={styles.metricsGrid}>
        <MetricCard label="Total Revenue"      value={formatCurrency(metrics.totalRevenue)}    icon="💰" color="#4CAF50"  loading={loading} />
        <MetricCard label="Today's Revenue"    value={formatCurrency(metrics.todayRevenue)}    icon="📅" color="#2196F3"  loading={loading} />
        <MetricCard label="This Week"          value={formatCurrency(metrics.weekRevenue)}     icon="📆" color="#9C27B0"  loading={loading} />
        <MetricCard label="This Month"         value={formatCurrency(metrics.monthRevenue)}    icon="🗓️"  color="#FF9800"  loading={loading} />
        <MetricCard label="Total Orders"       value={metrics.totalOrders}                     icon="📦" color="#333"     loading={loading} />
        <MetricCard label="⏳ Pending"         value={metrics.pending}                         icon="⏳" color="#FFA500"  loading={loading} />
        <MetricCard label="✅ Confirmed"       value={metrics.confirmed}                       icon="✅" color="#2196F3"  loading={loading} />
        <MetricCard label="🚚 Shipped"         value={metrics.shipped}                         icon="🚚" color="#9C27B0"  loading={loading} />
        <MetricCard label="📦 Delivered"       value={metrics.deliveredCount}                  icon="📦" color="#4CAF50"  loading={loading} />
        <MetricCard label="❌ Cancelled"       value={metrics.cancelled}                       icon="❌" color="#F44336"  loading={loading} />
        <MetricCard label="Avg Order Value"    value={formatCurrency(metrics.avgOrder)}        icon="📊" color="#4CAF50"  loading={loading} />
        <MetricCard label="Total Customers"    value={metrics.totalCustomers}                  icon="👥" color="#2196F3"  loading={loading} />
        <MetricCard label="Repeat Customers"   value={metrics.repeatCustomers}                 icon="🔁" color="#9C27B0"  loading={loading} />
      </div>

      {/* ── Charts ── */}
      <div style={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['revenue', 'orders', 'status'].map(tab => (
              <button key={tab} style={{
                ...styles.tabBtn,
                backgroundColor: chartTab === tab ? '#4CAF50' : '#f0f0f0',
                color: chartTab === tab ? '#fff' : '#333',
              }} onClick={() => setChartTab(tab)}>
                {tab === 'revenue' ? '💰 Revenue' : tab === 'orders' ? '📦 Orders' : '🥧 Status'}
              </button>
            ))}
          </div>
          {chartTab !== 'status' && (
            <div style={{ display: 'flex', gap: '6px' }}>
              {['today', '7days', '30days', 'year'].map(r => (
                <button key={r} style={{
                  ...styles.smallTabBtn,
                  backgroundColor: chartRange === r ? '#2196F3' : '#f0f0f0',
                  color: chartRange === r ? '#fff' : '#333',
                }} onClick={() => setChartRange(r)}>
                  {r === 'today' ? 'Today' : r === '7days' ? '7D' : r === '30days' ? '30D' : 'Year'}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <Skeleton height="150px" />
        ) : chartTab === 'revenue' ? (
          <LineChart data={chartData.revenue} color="#4CAF50" />
        ) : chartTab === 'orders' ? (
          <BarChart data={chartData.orders} color="#2196F3" />
        ) : (
          <PieChart data={pieData} />
        )}
      </div>

      {/* ── Insights ── */}
      {insights && !loading && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>💡 Insights</h3>
          <div style={styles.insightsGrid}>
            <div style={styles.insightCard}>
              <span style={styles.insightIcon}>📅</span>
              <div>
                <p style={styles.insightLabel}>Best Sales Day</p>
                <p style={styles.insightValue}>{insights.bestDay?.[0] || 'N/A'}</p>
                <p style={styles.insightSub}>{formatCurrency(insights.bestDay?.[1] || 0)}</p>
              </div>
            </div>
            <div style={styles.insightCard}>
              <span style={styles.insightIcon}>🗓️</span>
              <div>
                <p style={styles.insightLabel}>Best Month</p>
                <p style={styles.insightValue}>{insights.bestMonth?.[0] || 'N/A'}</p>
                <p style={styles.insightSub}>{formatCurrency(insights.bestMonth?.[1] || 0)}</p>
              </div>
            </div>
            <div style={styles.insightCard}>
              <span style={styles.insightIcon}>🔝</span>
              <div>
                <p style={styles.insightLabel}>Highest Order</p>
                <p style={styles.insightValue}>{formatCurrency(insights.highest)}</p>
              </div>
            </div>
            <div style={styles.insightCard}>
              <span style={styles.insightIcon}>🔽</span>
              <div>
                <p style={styles.insightLabel}>Lowest Order</p>
                <p style={styles.insightValue}>{formatCurrency(insights.lowest || 0)}</p>
              </div>
            </div>
            <div style={styles.insightCard}>
              <span style={styles.insightIcon}>{insights.revenueGrowth >= 0 ? '📈' : '📉'}</span>
              <div>
                <p style={styles.insightLabel}>Revenue Growth (30d)</p>
                <p style={{ ...styles.insightValue, color: insights.revenueGrowth >= 0 ? '#4CAF50' : '#F44336' }}>
                  {insights.revenueGrowth >= 0 ? '+' : ''}{insights.revenueGrowth}%
                </p>
              </div>
            </div>
            <div style={styles.insightCard}>
              <span style={styles.insightIcon}>{insights.orderGrowth >= 0 ? '📈' : '📉'}</span>
              <div>
                <p style={styles.insightLabel}>Order Growth (30d)</p>
                <p style={{ ...styles.insightValue, color: insights.orderGrowth >= 0 ? '#4CAF50' : '#F44336' }}>
                  {insights.orderGrowth >= 0 ? '+' : ''}{insights.orderGrowth}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Best Sellers ── */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>🏆 Best Selling Products</h3>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="40px" style={{ marginBottom: '8px' }} />)
        ) : bestSellers.length === 0 ? (
          <p style={styles.emptyText}>No product data yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Rank', 'Product', 'Units Sold', 'Revenue'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bestSellers.map(p => (
                  <tr key={p.name} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={{ fontSize: '18px' }}>
                        {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}
                      </span>
                    </td>
                    <td style={styles.td}><strong>{p.name}</strong></td>
                    <td style={styles.td}>{p.units}</td>
                    <td style={{ ...styles.td, color: '#4CAF50', fontWeight: 'bold' }}>{formatCurrency(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent Sales ── */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>🧾 Recent Sales ({filteredOrders.length})</h3>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height="48px" style={{ marginBottom: '8px' }} />)
        ) : filteredOrders.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{ fontSize: '32px' }}>📭</p>
            <p style={styles.emptyText}>No orders found for the selected period.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Order #', 'Customer', 'Phone', 'Total', 'Status', 'Payment', 'Date'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice(0, 50).map(order => (
                  <tr key={order.id} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={{ fontFamily: 'monospace', color: '#999' }}>
                        #{order.store_order_number || order.id}
                      </span>
                    </td>
                    <td style={styles.td}>{order.customer_name || 'N/A'}</td>
                    <td style={styles.td}>{order.phone_number || 'N/A'}</td>
                    <td style={{ ...styles.td, fontWeight: 'bold', color: '#4CAF50' }}>
                      {formatCurrency(getOrderAmount(order))}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '12px', fontSize: '11px',
                        fontWeight: 'bold', color: '#fff',
                        backgroundColor: statusColor[order.status] || '#999'
                      }}>
                        {(order.status || '').toUpperCase()}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '12px', color: '#666' }}>
                        {order.payment_method || 'N/A'} — {order.payment_status || 'N/A'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, color: '#999', fontSize: '12px' }}>
                      {formatDate(order.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOrders.length > 50 && (
              <p style={{ textAlign: 'center', color: '#999', fontSize: '13px', padding: '12px' }}>
                Showing 50 of {filteredOrders.length} orders. Export to see all.
              </p>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  container: { padding: '0', fontFamily: 'Arial, sans-serif' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', padding: '16px 20px', borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px', flexWrap: 'wrap', gap: '12px',
  },
  title: { margin: 0, fontSize: '22px', color: '#333' },
  subtitle: { margin: '4px 0 0', fontSize: '13px', color: '#999' },
  refreshBtn: {
    padding: '8px 16px', backgroundColor: '#4CAF50', color: '#fff',
    border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
  },
  exportBtn: {
    padding: '8px 16px', backgroundColor: '#2196F3', color: '#fff',
    border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
  },
  filterBar: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' },
  filterBtn: {
    padding: '6px 14px', border: 'none', borderRadius: '6px',
    cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
  },
  customDateRow: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' },
  dateInput: {
    padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd',
    fontSize: '13px', outline: 'none',
  },
  searchInput: {
    width: '100%', padding: '12px 16px', fontSize: '14px', borderRadius: '10px',
    border: '1px solid #ddd', marginBottom: '12px', boxSizing: 'border-box', outline: 'none',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '14px', marginBottom: '20px',
  },
  metricCard: {
    backgroundColor: '#fff', padding: '16px', borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  metricLabel: { margin: 0, fontSize: '12px', color: '#999', fontWeight: 'bold', textTransform: 'uppercase' },
  metricValue: { margin: '8px 0 0', fontSize: '24px', fontWeight: 'bold' },
  section: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px',
  },
  sectionTitle: { margin: '0 0 16px', fontSize: '16px', color: '#333', fontWeight: 'bold' },
  tabBtn: {
    padding: '8px 16px', border: 'none', borderRadius: '8px',
    cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
  },
  smallTabBtn: {
    padding: '5px 10px', border: 'none', borderRadius: '6px',
    cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
  },
  insightsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px',
  },
  insightCard: {
    backgroundColor: '#f9f9f9', borderRadius: '10px', padding: '14px',
    display: 'flex', gap: '10px', alignItems: 'flex-start',
  },
  insightIcon: { fontSize: '24px', flexShrink: 0 },
  insightLabel: { margin: 0, fontSize: '11px', color: '#999', textTransform: 'uppercase' },
  insightValue: { margin: '4px 0 0', fontSize: '16px', fontWeight: 'bold', color: '#333' },
  insightSub: { margin: '2px 0 0', fontSize: '12px', color: '#4CAF50' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    textAlign: 'left', padding: '10px 12px', backgroundColor: '#f5f5f5',
    color: '#555', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '12px', color: '#333', verticalAlign: 'middle' },
  emptyChart: { textAlign: 'center', color: '#999', padding: '40px', fontSize: '14px' },
  emptyState: { textAlign: 'center', padding: '40px' },
  emptyText: { color: '#999', fontSize: '14px' },
  errorBox: {
    backgroundColor: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '12px',
    padding: '20px', textAlign: 'center', color: '#c62828',
  },
  retryBtn: {
    padding: '8px 20px', backgroundColor: '#F44336', color: '#fff',
    border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '12px',
  },
}

export default Sales