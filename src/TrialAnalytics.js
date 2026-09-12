import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

function TrialAnalytics({ owner, onPlanStatusChange }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [checklist, setChecklist] = useState({
    productsSetup: false,
    trainingCompleted: false,
    demoOrderCompleted: false,
    customersIntroduced: false
  })
  const [savingChecklist, setSavingChecklist] = useState(false)
  // ✅ Period filter for paid Insights only — does not affect trial windowing.
  const [insightsPeriod, setInsightsPeriod] = useState('7d')

  useEffect(() => {
    if (owner?.id) fetchAnalytics(owner.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner?.id, insightsPeriod])

  const fetchAnalytics = async (storeId) => {
    try {
      setLoading(true)
      setError(null)

      // Trial dates and plan/subscription fields come only from shop_owners — never invented here.
      const { data: ownerRow, error: ownerError } = await supabase
        .from('shop_owners')
        .select('trial_start_date, trial_end_date, training_completed, customers_introduced, subscription_status, payment_status, plan_status')
        .eq('id', storeId)
        .maybeSingle()

      if (ownerError) {
        setError(ownerError.message)
        setLoading(false)
        return
      }

      const trialStart = ownerRow?.trial_start_date || null
      const trialEnd = ownerRow?.trial_end_date || null

      // ✅ Plan/subscription state, read as-is from shop_owners — no invented fields.
      const subscriptionStatus = ownerRow?.subscription_status || null
      const paymentStatus = ownerRow?.payment_status || null
      const planStatus = ownerRow?.plan_status || null

      const isTrialActive = !!(trialEnd && new Date(trialEnd).getTime() >= new Date().setHours(0, 0, 0, 0))

      const hasValidPaidPlan =
        (subscriptionStatus === 'monthly' || subscriptionStatus === 'yearly') &&
        paymentStatus === 'paid' &&
        planStatus === 'standard'

      // ✅ Report plan status up to App so the dashboard tab label can react.
      // Read-only signal — App owns no analytics logic itself.
      if (onPlanStatusChange) onPlanStatusChange({ hasValidPaidPlan, isTrialActive })

      // Trial metrics stay scoped to the trial's own start/end dates, exactly as before.
      const windowStart = trialStart
      const windowEnd = trialEnd

      // ✅ Paid Insights uses its own independent period window (Today / 7d / 30d),
      // never the trial window — a paid store may have no trial dates at all.
      const now = new Date()
      const insightsWindowEnd = now.toISOString()
      const insightsWindowStart = (() => {
        const start = new Date(now)
        if (insightsPeriod === 'today') {
          start.setHours(0, 0, 0, 0)
        } else if (insightsPeriod === '30d') {
          start.setDate(start.getDate() - 30)
        } else {
          start.setDate(start.getDate() - 7)
        }
        return start.toISOString()
      })()

      const scopedCount = async (table, timestampCol, extraFilters) => {
        let query = supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('store_id', storeId)
        if (windowStart) query = query.gte(timestampCol, windowStart)
        if (windowEnd) query = query.lte(timestampCol, windowEnd)
        if (extraFilters) query = extraFilters(query)
        const { count, error: qErr } = await query
        if (qErr) throw qErr
        return count || 0
      }

      const scopedUniquePhones = async (table, timestampCol) => {
        let query = supabase
          .from(table)
          .select('phone_number')
          .eq('store_id', storeId)
        if (windowStart) query = query.gte(timestampCol, windowStart)
        if (windowEnd) query = query.lte(timestampCol, windowEnd)
        const { data, error: qErr } = await query
        if (qErr) throw qErr
        const unique = new Set((data || []).map(r => r.phone_number).filter(Boolean))
        return unique.size
      }

      // ✅ Top-N product interest: raw rows fetched (store + period scoped),
      // tallied by product_id client-side, then joined to products for names.
      // No SQL/RPC added — plain select + in() only.
      const scopedProductIdCounts = async (table, timestampCol, windowS, windowE) => {
        let query = supabase
          .from(table)
          .select('product_id')
          .eq('store_id', storeId)
        if (windowS) query = query.gte(timestampCol, windowS)
        if (windowE) query = query.lte(timestampCol, windowE)
        const { data, error: qErr } = await query
        if (qErr) throw qErr
        const counts = {}
        for (const row of (data || [])) {
          if (!row.product_id) continue
          counts[row.product_id] = (counts[row.product_id] || 0) + 1
        }
        return counts
      }

      const topNFromCounts = async (counts, n) => {
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n)
        if (sorted.length === 0) return []
        const ids = sorted.map(([id]) => id)
        const { data: prodRows, error: prodErr } = await supabase
          .from('products')
          .select('id, product_name')
          .in('id', ids)
        if (prodErr) throw prodErr
        const nameById = {}
        ;(prodRows || []).forEach(p => { nameById[p.id] = p.product_name })
        return sorted.map(([id, count]) => ({
          productId: id,
          productName: nameById[id] || 'Unknown product',
          count
        }))
      }

      const [
        productViews,
        cartAdds,
        checkoutStarts,
        ordersCaptured,
        ordersCompleted,
        customersUsing,
        productsCount,
        ordersCount
      ] = await Promise.all([
        scopedCount('product_views', 'viewed_at'),
        scopedCount('cart_events', 'added_at'),
        scopedCount('checkout_events', 'started_at'),
        scopedCount('orders', 'created_at'),
        scopedCount('orders', 'created_at', (q) => q.eq('status', 'delivered')),
        scopedUniquePhones('product_views', 'viewed_at'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('store_id', storeId),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', storeId)
      ])

      // ✅ Paid-Insights-only data: fetched every time (cheap, small shop scale)
      // but only rendered when hasValidPaidPlan is true.
      let insightsData = null
      if (hasValidPaidPlan) {
        const [
          insightsProductViews,
          insightsCartAdds,
          insightsCheckoutStarts,
          insightsOrdersCaptured,
          insightsOrdersCompleted,
          insightsCustomersUsing,
          viewCounts,
          cartCounts
        ] = await Promise.all([
          scopedCount('product_views', 'viewed_at', null).then(async () => {
            // recompute with the Insights window rather than the trial window
            let q = supabase.from('product_views').select('*', { count: 'exact', head: true }).eq('store_id', storeId)
            q = q.gte('viewed_at', insightsWindowStart).lte('viewed_at', insightsWindowEnd)
            const { count, error: qErr } = await q
            if (qErr) throw qErr
            return count || 0
          }),
          (async () => {
            let q = supabase.from('cart_events').select('*', { count: 'exact', head: true }).eq('store_id', storeId)
            q = q.gte('added_at', insightsWindowStart).lte('added_at', insightsWindowEnd)
            const { count, error: qErr } = await q
            if (qErr) throw qErr
            return count || 0
          })(),
          (async () => {
            let q = supabase.from('checkout_events').select('*', { count: 'exact', head: true }).eq('store_id', storeId)
            q = q.gte('started_at', insightsWindowStart).lte('started_at', insightsWindowEnd)
            const { count, error: qErr } = await q
            if (qErr) throw qErr
            return count || 0
          })(),
          (async () => {
            let q = supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', storeId)
            q = q.gte('created_at', insightsWindowStart).lte('created_at', insightsWindowEnd)
            const { count, error: qErr } = await q
            if (qErr) throw qErr
            return count || 0
          })(),
          (async () => {
            let q = supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', storeId).eq('status', 'delivered')
            q = q.gte('created_at', insightsWindowStart).lte('created_at', insightsWindowEnd)
            const { count, error: qErr } = await q
            if (qErr) throw qErr
            return count || 0
          })(),
          (async () => {
            let q = supabase.from('product_views').select('phone_number').eq('store_id', storeId)
            q = q.gte('viewed_at', insightsWindowStart).lte('viewed_at', insightsWindowEnd)
            const { data, error: qErr } = await q
            if (qErr) throw qErr
            const unique = new Set((data || []).map(r => r.phone_number).filter(Boolean))
            return unique.size
          })(),
          scopedProductIdCounts('product_views', 'viewed_at', insightsWindowStart, insightsWindowEnd),
          scopedProductIdCounts('cart_events', 'added_at', insightsWindowStart, insightsWindowEnd)
        ])

        const [mostViewed, mostAddedToCart] = await Promise.all([
          topNFromCounts(viewCounts, 5),
          topNFromCounts(cartCounts, 5)
        ])

        insightsData = {
          period: insightsPeriod,
          productViews: insightsProductViews,
          cartAdds: insightsCartAdds,
          checkoutStarts: insightsCheckoutStarts,
          ordersCaptured: insightsOrdersCaptured,
          ordersCompleted: insightsOrdersCompleted,
          customersUsing: insightsCustomersUsing,
          mostViewed,
          mostAddedToCart
        }
      }

      setMetrics({
        trialStart,
        trialEnd,
        subscriptionStatus,
        paymentStatus,
        planStatus,
        isTrialActive,
        hasValidPaidPlan,
        customersUsing,
        productViews,
        cartAdds,
        checkoutStarts,
        ordersCaptured,
        ordersCompleted,
        insightsData
      })

      setChecklist({
        productsSetup: (productsCount?.count || 0) > 0,
        trainingCompleted: !!ownerRow?.training_completed,
        demoOrderCompleted: (ordersCount?.count || 0) > 0,
        customersIntroduced: !!ownerRow?.customers_introduced
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const daysRemaining = (() => {
    if (!metrics?.trialEnd) return null
    const end = new Date(metrics.trialEnd)
    const now = new Date()
    const diffMs = end.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
  })()

  const formatDate = (isoString) => {
    if (!isoString) return '—'
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  const toggleManualItem = async (field) => {
    if (!owner?.id) return
    try {
      setSavingChecklist(true)
      const newValue = !checklist[field === 'trainingCompleted' ? 'trainingCompleted' : 'customersIntroduced']
      const column = field === 'trainingCompleted' ? 'training_completed' : 'customers_introduced'

      const { error: updateError } = await supabase
        .from('shop_owners')
        .update({ [column]: newValue })
        .eq('id', owner.id)

      if (updateError) {
        setError(updateError.message)
        return
      }

      setChecklist(prev => ({ ...prev, [field]: newValue }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingChecklist(false)
    }
  }

  if (loading) {
    return (
      <div style={styles.center}>
        <p style={styles.loadingText}>⏳ Loading trial analytics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.errorBox}>
        <p>❌ Error: {error}</p>
        <button style={styles.retryBtn} onClick={() => fetchAnalytics(owner.id)}>
          Retry
        </button>
      </div>
    )
  }

  // ✅ Paid plan takes priority over everything else — checked before any
  // trial-date requirement, so a paid subscriber sees Insights even if
  // trial dates are missing or expired.
  if (!metrics.hasValidPaidPlan) {
    if (!metrics?.trialStart || !metrics?.trialEnd) {
      return (
        <div style={styles.center}>
          <p style={styles.emptyText}>📅 Trial dates haven't been set up for this store yet.</p>
          <p style={styles.emptySubText}>Contact StyleFlow support to get your trial started.</p>
        </div>
      )
    }

    // ✅ Trial ended + no valid paid plan → existing continue-plan style message,
    // reusing the same empty-state pattern already used above.
    if (!metrics.isTrialActive) {
      return (
        <div style={styles.center}>
          <p style={styles.emptyText}>⏳ Your trial has ended.</p>
          <p style={styles.emptySubText}>Subscribe to a StyleFlow plan to continue using your dashboard.</p>
        </div>
      )
    }
  }

  const usageStats = [
    { label: '👥 Customers Using StyleFlow', value: metrics.customersUsing },
    { label: '👀 Products Viewed', value: metrics.productViews },
    { label: '🛒 Added to Cart', value: metrics.cartAdds },
    { label: '✅ Checkout Started', value: metrics.checkoutStarts },
    { label: '📦 Orders Captured', value: metrics.ordersCaptured },
    { label: '🎉 Orders Completed', value: metrics.ordersCompleted }
  ]

  const checklistItems = [
    { key: 'productsSetup', label: 'Products Setup', manual: false },
    { key: 'trainingCompleted', label: 'Owner/Staff Training', manual: true },
    { key: 'demoOrderCompleted', label: 'Demo Order Completed', manual: false },
    { key: 'customersIntroduced', label: 'Customers Introduced to StyleFlow', manual: true }
  ]

  return (
    <div>
      {metrics.hasValidPaidPlan ? (
        <div>
          <div style={styles.trialCard}>
            <h3 style={styles.sectionTitle}>🌟 StyleFlow Insights</h3>
            <p style={styles.trialValue}>
              {metrics.subscriptionStatus === 'yearly' ? 'Yearly' : 'Monthly'} plan active
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              {[
                { key: 'today', label: 'Today' },
                { key: '7d', label: 'Last 7 Days' },
                { key: '30d', label: 'Last 30 Days' }
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => setInsightsPeriod(p.key)}
                  style={{
                    ...styles.checklistToggleBtn,
                    backgroundColor: insightsPeriod === p.key ? '#4CAF50' : '#f0f0f0',
                    color: insightsPeriod === p.key ? '#fff' : '#333'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <h3 style={styles.sectionTitle}>📊 Customer Journey</h3>
          <div style={styles.statsGrid}>
            {[
              { label: '👥 Customers Engaged', value: metrics.insightsData?.customersUsing || 0 },
              { label: '👀 Products Viewed', value: metrics.insightsData?.productViews || 0 },
              { label: '🛒 Added to Cart', value: metrics.insightsData?.cartAdds || 0 },
              { label: '✅ Checkout Started', value: metrics.insightsData?.checkoutStarts || 0 },
              { label: '📦 Orders Captured', value: metrics.insightsData?.ordersCaptured || 0 },
              { label: '🎉 Orders Completed', value: metrics.insightsData?.ordersCompleted || 0 }
            ].map(stat => (
              <div key={stat.label} style={styles.statCard}>
                <span style={styles.statNumber}>{stat.value}</span>
                <span style={styles.statLabel}>{stat.label}</span>
              </div>
            ))}
          </div>

          <h3 style={styles.sectionTitle}>🔻 Funnel</h3>
          <div style={styles.trialCard}>
            {[
              { label: 'Products Viewed', value: metrics.insightsData?.productViews || 0 },
              { label: 'Added to Cart', value: metrics.insightsData?.cartAdds || 0 },
              { label: 'Checkout Started', value: metrics.insightsData?.checkoutStarts || 0 },
              { label: 'Orders Captured', value: metrics.insightsData?.ordersCaptured || 0 }
            ].map((step, i, arr) => (
              <div key={step.label} style={{ marginBottom: i < arr.length - 1 ? '10px' : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={styles.checklistLabel}>{step.label}</span>
                  <span style={{ fontWeight: 'bold' }}>{step.value}</span>
                </div>
                {i < arr.length - 1 && <div style={{ textAlign: 'center', color: '#aaa' }}>↓</div>}
              </div>
            ))}
          </div>

          <h3 style={styles.sectionTitle}>🔥 Most Viewed Products</h3>
          <div style={styles.checklistBox}>
            {(metrics.insightsData?.mostViewed || []).length === 0 ? (
              <p style={styles.emptySubText}>No product views yet in this period.</p>
            ) : (
              metrics.insightsData.mostViewed.map(p => (
                <div key={p.productId} style={styles.checklistRow}>
                  <span style={styles.checklistLabel}>{p.productName}</span>
                  <span style={{ fontWeight: 'bold' }}>{p.count}</span>
                </div>
              ))
            )}
          </div>

          <h3 style={styles.sectionTitle}>🛒 Most Added-to-Cart Products</h3>
          <div style={styles.checklistBox}>
            {(metrics.insightsData?.mostAddedToCart || []).length === 0 ? (
              <p style={styles.emptySubText}>No cart activity yet in this period.</p>
            ) : (
              metrics.insightsData.mostAddedToCart.map(p => (
                <div key={p.productId} style={styles.checklistRow}>
                  <span style={styles.checklistLabel}>{p.productName}</span>
                  <span style={{ fontWeight: 'bold' }}>{p.count}</span>
                </div>
              ))
            )}
          </div>

          <h3 style={styles.sectionTitle}>💡 What this means</h3>
          <div style={styles.trialCard}>
            <p style={styles.trialValue}>
              {(() => {
                const d = metrics.insightsData
                if (!d) return 'Not enough data yet for this period.'
                const messages = []
                if (d.mostViewed?.[0]) {
                  messages.push(`Your ${d.mostViewed[0].productName} is getting the most product interest.`)
                }
                if (d.cartAdds > 0 && d.checkoutStarts > 0 && d.checkoutStarts < d.cartAdds) {
                  messages.push('Customers are adding products to cart but fewer are reaching checkout.')
                }
                if (d.checkoutStarts > 0 && d.ordersCaptured >= d.checkoutStarts) {
                  messages.push('Your customers are completing checkout successfully.')
                }
                if (messages.length === 0) {
                  messages.push('Not enough activity yet in this period to show a trend.')
                }
                return messages.join(' ')
              })()}
            </p>
          </div>
        </div>
      ) : metrics.isTrialActive ? (
        <div style={styles.trialCard}>
          <h3 style={styles.sectionTitle}>📅 Your 14-Day Trial</h3>
          <div style={styles.trialRow}>
            <div style={styles.trialItem}>
              <span style={styles.trialLabel}>Trial Start</span>
              <span style={styles.trialValue}>{formatDate(metrics.trialStart)}</span>
            </div>
            <div style={styles.trialItem}>
              <span style={styles.trialLabel}>Trial End</span>
              <span style={styles.trialValue}>{formatDate(metrics.trialEnd)}</span>
            </div>
            <div style={styles.trialItem}>
              <span style={styles.trialLabel}>Days Remaining</span>
              <span style={{
                ...styles.trialValue,
                color: daysRemaining !== null && daysRemaining <= 3 ? '#e53935' : '#2e7d32',
                fontWeight: 'bold'
              }}>
                {daysRemaining !== null ? `${daysRemaining} days` : '—'}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <h3 style={styles.sectionTitle}>📊 Is StyleFlow Being Used?</h3>
      <div style={styles.statsGrid}>
        {usageStats.map(stat => (
          <div key={stat.label} style={styles.statCard}>
            <span style={styles.statNumber}>{stat.value}</span>
            <span style={styles.statLabel}>{stat.label}</span>
          </div>
        ))}
      </div>

      {!metrics.hasValidPaidPlan && (
        <>
          <h3 style={styles.sectionTitle}>✅ Onboarding Checklist</h3>
          <div style={styles.checklistBox}>
            {checklistItems.map(item => (
              <div key={item.key} style={styles.checklistRow}>
                <span style={styles.checklistLabel}>
                  {checklist[item.key] ? '☑️' : '☐'} {item.label}
                </span>
                {item.manual && (
                  <button
                    style={styles.checklistToggleBtn}
                    disabled={savingChecklist}
                    onClick={() => toggleManualItem(item.key)}
                  >
                    {checklist[item.key] ? 'Mark Incomplete' : 'Mark Complete'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const styles = {
  center: {
    textAlign: 'center',
    padding: '40px 20px'
  },
  loadingText: {
    fontSize: '16px',
    color: '#666'
  },
  emptyText: {
    fontSize: '16px',
    color: '#333',
    fontWeight: 'bold'
  },
  emptySubText: {
    fontSize: '14px',
    color: '#888',
    marginTop: '8px'
  },
  errorBox: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '16px',
    borderRadius: '8px',
    margin: '16px 0'
  },
  retryBtn: {
    marginTop: '8px',
    padding: '8px 16px',
    backgroundColor: '#c62828',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    margin: '20px 0 12px 0',
    color: '#333'
  },
  trialCard: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    padding: '16px'
  },
  trialRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    marginTop: '8px'
  },
  trialItem: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: '120px'
  },
  trialLabel: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '4px'
  },
  trialValue: {
    fontSize: '16px',
    color: '#333'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px'
  },
  statCard: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center'
  },
  statNumber: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#4CAF50'
  },
  statLabel: {
    fontSize: '13px',
    color: '#666',
    marginTop: '4px'
  },
  checklistBox: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    padding: '8px 16px'
  },
  checklistRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #f0f0f0'
  },
  checklistLabel: {
    fontSize: '14px',
    color: '#333'
  },
  checklistToggleBtn: {
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    borderRadius: '6px',
    cursor: 'pointer'
  }
}

export default TrialAnalytics