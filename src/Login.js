import { useState } from 'react'
import { supabase } from './supabase.js'

function Login({ onLoginSuccess }) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // ✅ FIXED handleLogin — uses maybeSingle + proper error handling
  async function handleLogin() {
    try {
      setLoading(true)
      setError(null)

      const cleanPhone = phone.trim()
      const cleanPassword = password.trim()

      const { data, error } = await supabase
        .from('shop_owners')
        .select('*')
        .eq('phone_number', cleanPhone)
        .eq('password', cleanPassword)
        .maybeSingle()

      console.log("LOGIN PHONE:", cleanPhone)
      console.log("LOGIN DATA:", data)
      console.log("LOGIN ERROR:", error)

      if (error) {
        console.error("❌ Login query error:", error)
        setError("Login failed")
        return
      }

      if (!data) {
        setError("Invalid credentials")
        return
      }

      if (!data.id) {
        console.error("❌ No ID in shop_owners row")
        setError("Database issue: missing shop id")
        return
      }

      // ✅ Subscription access control — blocks cancelled/expired accounts before granting dashboard access
      if (data.subscription_status === 'cancelled' || data.subscription_status === 'expired') {
        setError("Your StyleFlow subscription is inactive. Please renew your plan to continue using the dashboard.")
        return
      }

      localStorage.setItem('store_id', String(data.id))
      localStorage.setItem('styleflow_owner', JSON.stringify(data))

      console.log("✅ STORED STORE ID:", data.id)
      onLoginSuccess(data)

    } catch (err) {
      console.error("❌ LOGIN CATCH:", err)
      setError("Login failed")
    } finally {
      setLoading(false)
    }
  }

  function handleKeyPress(e) {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>

        <div style={styles.logoSection}>
          <h1 style={styles.logo}>🛍️ StyleFlow</h1>
          <p style={styles.tagline}>Store Owner Dashboard</p>
        </div>

        <div style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>📱 Phone Number</label>
            <input
              style={styles.input}
              type="tel"
              placeholder="Enter your phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyPress={handleKeyPress}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>🔒 Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
            />
          </div>

          {error && (
            <div style={styles.errorBox}>
              ❌ {error}
            </div>
          )}

          <button
            style={{
              ...styles.loginBtn,
              opacity: loading ? 0.7 : 1,
            }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? '⏳ Logging in...' : '🚀 Login'}
          </button>
        </div>

      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
  logoSection: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  logo: {
    margin: '0 0 8px',
    fontSize: '32px',
    color: '#333',
  },
  tagline: {
    margin: 0,
    fontSize: '14px',
    color: '#999',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
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
    fontSize: '15px',
    outline: 'none',
    backgroundColor: '#fafafa',
    boxSizing: 'border-box',
    width: '100%',
  },
  errorBox: {
    backgroundColor: '#ffebee',
    border: '1px solid #ffcdd2',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '14px',
    color: '#c62828',
    textAlign: 'center',
  },
  loginBtn: {
    padding: '14px',
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
  },
}

export default Login