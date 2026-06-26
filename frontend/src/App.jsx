import React, { createContext, useContext, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  ClipboardList, 
  History, 
  Settings, 
  LogOut, 
  User, 
  TrendingUp, 
  UserCheck, 
  UserX, 
  ShieldAlert, 
  Upload, 
  Wrench, 
  SlidersHorizontal,
  ChevronRight,
  Menu,
  Lock,
  Loader,
  ArrowRight,
  TrendingDown,
  Info,
  Search
} from "lucide-react";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area 
} from "recharts";
import { api } from "./utils/api";

// ----------------------------------------------------
// AUTHENTICATION CONTEXT
// ----------------------------------------------------
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check login on boot
  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const username = localStorage.getItem("username");
    const id = localStorage.getItem("userId");
    
    if (token && role && username && id) {
      setUser({ token, role, username, id: parseInt(id) });
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const data = await api.auth.login(username, password);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("username", data.username);
      localStorage.setItem("userId", data.id.toString());
      
      const loggedUser = {
        token: data.access_token,
        role: data.role,
        username: data.username,
        id: data.id
      };
      setUser(loggedUser);
      setLoading(false);
      return loggedUser;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const signup = async (username, password, role = "user") => {
    setLoading(true);
    try {
      const data = await api.auth.signup(username, password, role);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("username", data.username);
      localStorage.setItem("userId", data.id.toString());
      
      const loggedUser = {
        token: data.access_token,
        role: data.role,
        username: data.username,
        id: data.id
      };
      setUser(loggedUser);
      setLoading(false);
      return loggedUser;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    localStorage.removeItem("userId");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Route Guards
function RequireAuth({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <div className="spinner"></div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// ----------------------------------------------------
// NAVIGATION SIDEBAR
// ----------------------------------------------------
function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">
          <ShieldAlert size={28} />
        </span>
        <h1>Credit Risk App</h1>
      </div>
      <ul className="sidebar-menu">
        <li>
          <Link to="/" className={`sidebar-link ${location.pathname === "/" ? "active" : ""}`}>
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
        </li>
        <li>
          <Link to="/predict" className={`sidebar-link ${location.pathname === "/predict" ? "active" : ""}`}>
            <ClipboardList size={20} />
            Loan Predictor
          </Link>
        </li>
        <li>
          <Link to="/history" className={`sidebar-link ${location.pathname === "/history" ? "active" : ""}`}>
            <History size={20} />
            Past Predictions
          </Link>
        </li>
        {user?.role === "admin" && (
          <li>
            <Link to="/admin" className={`sidebar-link ${location.pathname === "/admin" ? "active" : ""}`}>
              <SlidersHorizontal size={20} />
              Admin Panel
            </Link>
          </li>
        )}
      </ul>
      <div className="sidebar-footer">
        <div className="user-profile-widget">
          <div className="user-avatar">
            {user?.username?.substring(0, 2).toUpperCase()}
          </div>
          <div className="user-info">
            <span className="user-name">{user?.username}</span>
            <span className="user-role">{user?.role}</span>
          </div>
        </div>
        <button onClick={handleLogout} className="logout-btn">
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

// ----------------------------------------------------
// LOGIN & SIGNUP PAGES
// ----------------------------------------------------
function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [pending, setPending] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setPending(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (e) {
      setErr(e.message || "Invalid credentials.");
      setPending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="glass-card auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <ShieldAlert size={48} />
          </div>
          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-subtitle">Credit Risk & Loan Prediction System</p>
        </div>
        {err && <div className="feedback-alert error">{err}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. admin or user" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={pending} className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }}>
            {pending ? <div className="spinner" style={{ width: "16px", height: "16px" }}></div> : "Sign In"}
          </button>
        </form>
        <div className="auth-switch">
          Don't have an account? <Link to="/signup" className="auth-switch-link">Create one</Link>
        </div>
      </div>
    </div>
  );
}

function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [err, setErr] = useState("");
  const [pending, setPending] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setPending(true);
    try {
      await signup(username, password, role);
      navigate("/");
    } catch (e) {
      setErr(e.message || "Failed to sign up.");
      setPending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="glass-card auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <ShieldAlert size={48} />
          </div>
          <h2 className="auth-title">Create Account</h2>
          <p className="auth-subtitle">Register to prediction portal</p>
        </div>
        {err && <div className="feedback-alert error">{err}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Create username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="Minimum 6 characters" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Access Role</label>
            <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">Normal Applicant</option>
              <option value="admin">System Admin</option>
            </select>
          </div>
          <button type="submit" disabled={pending} className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }}>
            {pending ? <div className="spinner" style={{ width: "16px", height: "16px" }}></div> : "Register Account"}
          </button>
        </form>
        <div className="auth-switch">
          Already registered? <Link to="/login" className="auth-switch-link">Login here</Link>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// DASHBOARD PAGE
// ----------------------------------------------------
function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.dashboard.getStats();
        setStats(data);
      } catch (e) {
        setErr("Failed to load dashboard statistics.");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "80px" }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const roleStats = user.role === "admin" ? stats : stats?.user_stats;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{user.role === "admin" ? "Administrative Dashboard" : "Applicant Dashboard"}</h2>
        <p className="page-subtitle">Real-time statistics, approval rates, and model monitoring.</p>
      </div>
      
      {err && <div className="feedback-alert error">{err}</div>}

      <div className="grid-3" style={{ marginBottom: "32px" }}>
        <div className="glass-card metric-card">
          <div className="metric-icon indigo">
            <ClipboardList size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Total Applications</span>
            <span className="metric-value">{roleStats?.total_applications || 0}</span>
          </div>
        </div>
        <div className="glass-card metric-card">
          <div className="metric-icon emerald">
            <UserCheck size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Approval Rate</span>
            <span className="metric-value">{roleStats?.approval_rate || 0}%</span>
          </div>
        </div>
        <div className="glass-card metric-card">
          <div className="metric-icon rose">
            <UserX size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Rejection Rate</span>
            <span className="metric-value">{roleStats?.rejection_rate || 0}%</span>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="glass-card">
          <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "20px" }}>System Summary</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Portal Users</span>
              <span style={{ fontWeight: 600 }}>{stats?.active_users || 0} Registered</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Role Level</span>
              <span style={{ fontWeight: 600, textTransform: "uppercase", color: "var(--color-accent)" }}>{user.role}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "4px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Data Preprocessing</span>
              <span style={{ color: "var(--color-success)", fontWeight: 600 }}>Active</span>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "20px" }}>Active ML Model</h3>
          {stats?.active_model ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
                <span style={{ color: "var(--text-secondary)" }}>Selected Best Model</span>
                <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>{stats.active_model.name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
                <span style={{ color: "var(--text-secondary)" }}>Model Accuracy</span>
                <span style={{ fontWeight: 600 }}>{Math.round(stats.active_model.accuracy * 1000) / 10}%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "4px" }}>
                <span style={{ color: "var(--text-secondary)" }}>Training Date</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {new Date(stats.active_model.timestamp).toLocaleDateString()}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "120px", color: "var(--text-muted)" }}>
              No active model trained. Run training from Admin Panel.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// LOAN PREDICTOR FORM & RESULTS PAGE
// ----------------------------------------------------
// ─── Kaggle-style sample profiles ─────────────────────────────────────────
// Each entry mirrors data from three popular Kaggle datasets:
//  • Loan Prediction Dataset (LoanAmount, ApplicantIncome, Credit_History…)
//  • Credit Risk Dataset  (person_age, person_income, loan_int_rate…)
//  • German Credit Dataset (credit_amount, duration, savings_account…)
// The field names are our internal schema; the comments show original Kaggle names.
const KAGGLE_SAMPLES = [
  {
    label: "✅ Strong Applicant (Loan Prediction DS)",
    kaggle_source: "Loan Prediction Dataset",
    description: "Married graduate, urban area, strong credit history (1) → ApplicantIncome 6000, LoanAmount 150",
    data: {
      full_name: "Priya Sharma",
      age: 34,
      gender: "Female",
      income: 6000,            // ApplicantIncome + CoapplicantIncome
      employment_status: "Employed",
      loan_amount: 150000,     // LoanAmount * 1000 (Kaggle is in thousands)
      loan_term: 360,          // Loan_Amount_Term (months)
      credit_score: 750,       // Credit_History: 1 → mapped to 750
      existing_debt: 1800,
      education: "Bachelor",   // Education: Graduate
      marital_status: "Married",
      dependents: 1,           // Dependents: 1
      property_area: "Urban"   // Property_Area: Urban
    }
  },
  {
    label: "⚠️ Risky Applicant (Loan Prediction DS)",
    kaggle_source: "Loan Prediction Dataset",
    description: "Self-employed, rural, no credit history (0) → low income, high loan request",
    data: {
      full_name: "Rajesh Kumar",
      age: 42,
      gender: "Male",
      income: 2500,            // Low ApplicantIncome
      employment_status: "Self-Employed",
      loan_amount: 200000,     // High LoanAmount
      loan_term: 360,
      credit_score: 450,       // Credit_History: 0 → mapped to 450
      existing_debt: 18000,
      education: "High School", // Education: Not Graduate
      marital_status: "Married",
      dependents: 3,
      property_area: "Rural"
    }
  },
  {
    label: "✅ Low-Risk Professional (Credit Risk DS)",
    kaggle_source: "Credit Risk Dataset",
    description: "person_age 28, person_income 72000, loan_int_rate 7.9, cb_person_cred_hist_length 3",
    data: {
      full_name: "Aisha Patel",
      age: 28,
      gender: "Female",
      income: 6000,            // person_income 72000 / 12
      employment_status: "Employed",
      loan_amount: 9000,       // loan_amnt
      loan_term: 36,           // loan_term (months)
      credit_score: 720,       // cb_person_cred_hist_length → mapped score
      existing_debt: 1200,     // derived from loan_percent_income
      education: "Master",     // person_education
      marital_status: "Single",
      dependents: 0,
      property_area: "Urban"
    }
  },
  {
    label: "🔴 High-Risk Young Borrower (Credit Risk DS)",
    kaggle_source: "Credit Risk Dataset",
    description: "person_age 22, person_income 30000, loan_intent: EDUCATION, high loan_percent_income",
    data: {
      full_name: "Arjun Mehta",
      age: 22,
      gender: "Male",
      income: 2500,            // person_income 30000 / 12
      employment_status: "Student",
      loan_amount: 20000,      // loan_amnt (high relative to income)
      loan_term: 60,
      credit_score: 580,       // short credit history
      existing_debt: 5000,
      education: "Associate",
      marital_status: "Single",
      dependents: 0,
      property_area: "Semi-Urban"
    }
  },
  {
    label: "✅ Creditworthy Senior (German Credit DS)",
    kaggle_source: "German Credit Dataset",
    description: "Skilled job, owned property, 12-month duration, savings > 1000 DM, good credit",
    data: {
      full_name: "Hans Werner",
      age: 52,
      gender: "Male",
      income: 5200,            // Derived from credit_amount / duration
      employment_status: "Employed",
      loan_amount: 12000,      // credit_amount (converted from DM)
      loan_term: 12,           // duration (months)
      credit_score: 780,       // Good credit history class
      existing_debt: 800,
      education: "Bachelor",   // Skilled worker
      marital_status: "Married",
      dependents: 2,
      property_area: "Urban"
    }
  },
  {
    label: "⚠️ Unemployed Risk Case (German Credit DS)",
    kaggle_source: "German Credit Dataset",
    description: "Unemployed/unskilled, 48-month loan, no savings, existing credits at bank",
    data: {
      full_name: "Luisa Braun",
      age: 38,
      gender: "Female",
      income: 1800,
      employment_status: "Unemployed",
      loan_amount: 50000,      // High credit_amount
      loan_term: 48,           // duration
      credit_score: 480,       // Poor credit class
      existing_debt: 22000,
      education: "High School", // Unskilled resident
      marital_status: "Divorced",
      dependents: 1,
      property_area: "Rural"
    }
  }
];

const KAGGLE_COLUMN_MAP = [
  { kaggle: "ApplicantIncome",           ours: "Income",                  dataset: "Loan Prediction" },
  { kaggle: "CoapplicantIncome",         ours: "Income (added)",           dataset: "Loan Prediction" },
  { kaggle: "LoanAmount (×1000)",        ours: "Loan Amount",              dataset: "Loan Prediction" },
  { kaggle: "Loan_Amount_Term",          ours: "Loan Term",                dataset: "Loan Prediction" },
  { kaggle: "Credit_History (0/1)",      ours: "Credit Score (450/750)",   dataset: "Loan Prediction" },
  { kaggle: "Education",                 ours: "Education",                dataset: "Loan Prediction" },
  { kaggle: "Married",                   ours: "Marital Status",           dataset: "Loan Prediction" },
  { kaggle: "Dependents",               ours: "Number of Dependents",     dataset: "Loan Prediction" },
  { kaggle: "Property_Area",             ours: "Property Area",            dataset: "Loan Prediction" },
  { kaggle: "person_age",                ours: "Age",                      dataset: "Credit Risk" },
  { kaggle: "person_income (/12)",       ours: "Income",                   dataset: "Credit Risk" },
  { kaggle: "person_emp_length",         ours: "Employment Status",        dataset: "Credit Risk" },
  { kaggle: "person_education",          ours: "Education",                dataset: "Credit Risk" },
  { kaggle: "loan_amnt",                 ours: "Loan Amount",              dataset: "Credit Risk" },
  { kaggle: "loan_term (months)",        ours: "Loan Term",                dataset: "Credit Risk" },
  { kaggle: "cb_person_cred_hist_length",ours: "Credit Score (derived)",   dataset: "Credit Risk" },
  { kaggle: "credit_amount",             ours: "Loan Amount",              dataset: "German Credit" },
  { kaggle: "duration (months)",         ours: "Loan Term",                dataset: "German Credit" },
  { kaggle: "savings_account",           ours: "Existing Debt (inferred)", dataset: "German Credit" },
  { kaggle: "job",                       ours: "Employment Status",        dataset: "German Credit" },
];

function PredictPage() {
  const [formData, setFormData] = useState({
    full_name: "",
    age: 30,
    gender: "Male",
    income: 5000,
    employment_status: "Employed",
    loan_amount: 30000,
    loan_term: 60,
    credit_score: 680,
    existing_debt: 2000,
    education: "Bachelor",
    marital_status: "Single",
    dependents: 0,
    property_area: "Semi-Urban"
  });
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [showSampleLoader, setShowSampleLoader] = useState(false);
  const [showMappingRef, setShowMappingRef] = useState(false);
  const [activeSampleDataset, setActiveSampleDataset] = useState("All");

  const loadSample = (sample) => {
    setFormData(sample.data);
    setShowSampleLoader(false);
    setResult(null);
    setErr("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ["age", "income", "loan_amount", "loan_term", "credit_score", "existing_debt", "dependents"].includes(name)
        ? parseFloat(value) || 0
        : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPending(true);
    setErr("");
    try {
      const data = await api.predictions.predict(formData);
      setResult(data);
    } catch (e) {
      setErr(e.message || "Failed to complete inference.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Predictive Loan Risk Application</h2>
        <p className="page-subtitle">Submit applicant particulars to run ML models for credit evaluation.</p>
      </div>

      {err && <div className="feedback-alert error">{err}</div>}

      {/* ── Kaggle Sample Loader Banner ───────────────────────────── */}
      <div className="glass-card" style={{ marginBottom: "24px", padding: "20px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "1.05rem", marginBottom: "4px" }}>
              🔬 Kaggle Sample Input Loader
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Load pre-mapped real Kaggle dataset profiles — Loan Prediction, Credit Risk, and German Credit datasets.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: "0.85rem", padding: "8px 16px" }}
              onClick={() => { setShowMappingRef(v => !v); setShowSampleLoader(false); }}
            >
              {showMappingRef ? "Hide" : "View"} Column Mapping Reference
            </button>
            <button
              className="btn btn-primary"
              style={{ fontSize: "0.85rem", padding: "8px 16px" }}
              onClick={() => { setShowSampleLoader(v => !v); setShowMappingRef(false); }}
            >
              {showSampleLoader ? "Close" : "Load Sample Profile"}
            </button>
          </div>
        </div>

        {/* ── Sample Profile Cards ── */}
        {showSampleLoader && (
          <div style={{ marginTop: "20px" }}>
            {/* Dataset filter tabs */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              {["All", "Loan Prediction", "Credit Risk", "German Credit"].map(ds => (
                <button
                  key={ds}
                  onClick={() => setActiveSampleDataset(ds)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    border: "1px solid var(--border-color)",
                    background: activeSampleDataset === ds ? "var(--color-primary)" : "transparent",
                    color: activeSampleDataset === ds ? "#fff" : "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    transition: "all 0.2s"
                  }}
                >
                  {ds}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "12px" }}>
              {KAGGLE_SAMPLES
                .filter(s => activeSampleDataset === "All" || s.kaggle_source === activeSampleDataset)
                .map((sample, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "16px",
                      borderRadius: "10px",
                      border: "1px solid var(--border-color)",
                      background: "rgba(255,255,255,0.02)",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--color-primary)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border-color)"}
                    onClick={() => loadSample(sample)}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "6px" }}>{sample.label}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-primary)", marginBottom: "8px", fontWeight: 600 }}>
                      Source: {sample.kaggle_source}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{sample.description}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                      {[
                        `Age: ${sample.data.age}`,
                        `Income: $${sample.data.income.toLocaleString()}`,
                        `Loan: $${sample.data.loan_amount.toLocaleString()}`,
                        `Score: ${sample.data.credit_score}`
                      ].map((tag, ti) => (
                        <span key={ti} style={{ padding: "2px 8px", borderRadius: "12px", background: "rgba(99,102,241,0.1)", color: "var(--color-primary)", fontSize: "0.72rem", fontWeight: 600 }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Column Mapping Reference Table ── */}
        {showMappingRef && (
          <div style={{ marginTop: "20px" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "12px" }}>
              When you upload a Kaggle CSV, our backend automatically detects these column aliases and maps them to the standard schema:
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="custom-table" style={{ fontSize: "0.82rem" }}>
                <thead>
                  <tr>
                    <th>Kaggle Column Name</th>
                    <th>Our Standard Field</th>
                    <th>Dataset Origin</th>
                  </tr>
                </thead>
                <tbody>
                  {KAGGLE_COLUMN_MAP.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontFamily: "monospace", color: "var(--color-accent)" }}>{row.kaggle}</td>
                      <td style={{ fontWeight: 600 }}>{row.ours}</td>
                      <td>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: "10px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: row.dataset === "Loan Prediction" ? "rgba(99,102,241,0.1)" : row.dataset === "Credit Risk" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                          color: row.dataset === "Loan Prediction" ? "var(--color-primary)" : row.dataset === "Credit Risk" ? "var(--color-success)" : "var(--color-warning)"
                        }}>
                          {row.dataset}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: result ? "1fr 1fr" : "1fr", gap: "32px", alignItems: "start" }}>
        
        {/* Form panel */}
        <div className="glass-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <h3 style={{ fontFamily: "var(--font-heading)" }}>Applicant Questionnaire</h3>
            {formData.full_name && (
              <span style={{ fontSize: "0.78rem", padding: "4px 10px", borderRadius: "12px", background: "rgba(99,102,241,0.1)", color: "var(--color-primary)", fontWeight: 600 }}>
                Sample loaded ✓
              </span>
            )}
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input 
                type="text" 
                name="full_name" 
                className="form-input" 
                placeholder="Applicant's Name" 
                value={formData.full_name}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Age</label>
                <input 
                  type="number" 
                  name="age" 
                  className="form-input" 
                  min="18" 
                  max="100" 
                  value={formData.age}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select name="gender" className="form-select" value={formData.gender} onChange={handleChange}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Monthly Income ($)</label>
                <input 
                  type="number" 
                  name="income" 
                  className="form-input" 
                  min="100" 
                  value={formData.income}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Employment Type</label>
                <select name="employment_status" className="form-select" value={formData.employment_status} onChange={handleChange}>
                  <option value="Employed">Salaried / Employed</option>
                  <option value="Self-Employed">Self-Employed</option>
                  <option value="Student">Student</option>
                  <option value="Unemployed">Unemployed</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Loan Request Amount ($)</label>
                <input 
                  type="number" 
                  name="loan_amount" 
                  className="form-input" 
                  min="500" 
                  value={formData.loan_amount}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Term Duration (Months)</label>
                <select name="loan_term" className="form-select" value={formData.loan_term} onChange={handleChange}>
                  <option value={12}>12 Months (1 yr)</option>
                  <option value={24}>24 Months (2 yrs)</option>
                  <option value={36}>36 Months (3 yrs)</option>
                  <option value={60}>60 Months (5 yrs)</option>
                  <option value={120}>120 Months (10 yrs)</option>
                  <option value={180}>180 Months (15 yrs)</option>
                  <option value={240}>240 Months (20 yrs)</option>
                  <option value={360}>360 Months (30 yrs)</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Credit Score (300-850)</label>
                <input 
                  type="number" 
                  name="credit_score" 
                  className="form-input" 
                  min="300" 
                  max="850" 
                  value={formData.credit_score}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Existing Debt Balance ($)</label>
                <input 
                  type="number" 
                  name="existing_debt" 
                  className="form-input" 
                  min="0" 
                  value={formData.existing_debt}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Education Level</label>
                <select name="education" className="form-select" value={formData.education} onChange={handleChange}>
                  <option value="High School">High School</option>
                  <option value="Associate">Associate Degree</option>
                  <option value="Bachelor">Bachelor Degree</option>
                  <option value="Master">Master Degree</option>
                  <option value="PhD">PhD / Doctorate</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Marital Status</label>
                <select name="marital_status" className="form-select" value={formData.marital_status} onChange={handleChange}>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Number of Dependents</label>
                <input 
                  type="number" 
                  name="dependents" 
                  className="form-input" 
                  min="0" 
                  max="20" 
                  value={formData.dependents}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Property Location</label>
                <select name="property_area" className="form-select" value={formData.property_area} onChange={handleChange}>
                  <option value="Urban">Urban</option>
                  <option value="Semi-Urban">Semi-Urban</option>
                  <option value="Rural">Rural</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={pending} className="btn btn-primary" style={{ width: "100%", marginTop: "16px" }}>
              {pending ? <div className="spinner" style={{ width: "16px", height: "16px" }}></div> : "Evaluate Loan Eligibility"}
            </button>
          </form>
        </div>

        {/* Results Visualizer Panel */}
        {result && (
          <div className="glass-card prediction-results-box">
            <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "20px" }}>Evaluation Result</h3>
            
            <div className="prediction-badge-container">
              <span className={`prediction-badge ${result.prediction.toLowerCase()}`}>
                {result.prediction}
              </span>
            </div>

            {/* Semicircle approval gauge */}
            <div className="gauge-outer">
              <div className="gauge-semicircle" style={{ transform: `rotate(${result.probability * 1.8 - 45}deg)` }}></div>
              <div className="gauge-overlay">
                <span className="gauge-val">{result.probability}%</span>
                <div className="gauge-label">Approval Probability</div>
              </div>
            </div>

            {/* Risk Class pill */}
            <div style={{ marginBottom: "20px" }}>
              <span className={`risk-pill ${result.risk_class.split(" ")[0].toLowerCase()}`}>
                Risk Level: {result.risk_class}
              </span>
            </div>

            <p className="risk-explanation-text">
              {result.risk_explanation}
            </p>

            <div className="factors-container">
              <div className="factor-group positive">
                <h4>Positive Mitigating Factors</h4>
                <ul className="factor-list">
                  {result.contributing_factors.positive.map((factor, idx) => (
                    <li key={idx} className="factor-item">{factor}</li>
                  ))}
                </ul>
              </div>

              <div className="factor-group negative">
                <h4>Key Credit Risk Factors</h4>
                <ul className="factor-list">
                  {result.contributing_factors.negative.map((factor, idx) => (
                    <li key={idx} className="factor-item">{factor}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ----------------------------------------------------
// PAST PREDICTIONS HISTORY PAGE
// ----------------------------------------------------
function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await api.predictions.getHistory();
        setHistory(data);
      } catch (e) {
        setErr("Failed to load historical database records.");
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filteredHistory = history.filter(item => 
    item.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "80px" }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Predictions Registry</h2>
        <p className="page-subtitle">Search, filter, and audit past loan evaluation results.</p>
      </div>

      {err && <div className="feedback-alert error">{err}</div>}

      <div className="glass-card">
        <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: "14px", top: "12px", color: "var(--text-muted)" }}>
              <Search size={18} />
            </span>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search applicant name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", paddingLeft: "42px" }}
            />
          </div>
        </div>

        <div className="table-container">
          {filteredHistory.length > 0 ? (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Applicant Name</th>
                  <th>Age</th>
                  <th>Monthly Income</th>
                  <th>Request Amount</th>
                  <th>Credit Score</th>
                  <th>DTI</th>
                  <th>Decision</th>
                  <th>Risk Tier</th>
                  <th>Evaluated On</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((row) => {
                  const cf = row.contributing_factors;
                  return (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600 }}>{row.full_name}</td>
                      <td>{row.age}</td>
                      <td>${row.income.toLocaleString()}</td>
                      <td>${row.loan_amount.toLocaleString()}</td>
                      <td>{row.credit_score}</td>
                      <td>{cf?.dti_ratio ? `${(cf.dti_ratio * 100).toFixed(1)}%` : "N/A"}</td>
                      <td>
                        <span style={{ 
                          color: row.prediction === "Approved" ? "var(--color-success)" : "var(--color-danger)",
                          fontWeight: 700 
                        }}>
                          {row.prediction}
                        </span>
                      </td>
                      <td>
                        <span className={`risk-pill ${row.risk_class.split(" ")[0].toLowerCase()}`} style={{ fontSize: "0.75rem", padding: "4px 8px" }}>
                          {row.risk_class}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                        {new Date(row.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              No prediction records found matching the criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// ADMIN PANEL PAGE
// ----------------------------------------------------
function AdminPanelPage() {
  const [activeTab, setActiveTab] = useState("dataset");
  
  // Tab 1: Dataset State
  const [datasetStatus, setDatasetStatus] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPending, setUploadPending] = useState(false);
  const [preprocessPending, setPreprocessPending] = useState(false);
  const [preprocessStats, setPreprocessStats] = useState(null);
  const [datasetMsg, setDatasetMsg] = useState("");
  const [datasetErr, setDatasetErr] = useState("");

  // Tab 2: EDA state
  const [edaData, setEdaData] = useState(null);
  const [edaLoading, setEdaLoading] = useState(false);
  
  // Tab 3: Feature selection state
  const [availableFeatures, setAvailableFeatures] = useState([]);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [featureAverages, setFeatureAverages] = useState(null);
  const [featureLoading, setFeatureLoading] = useState(false);
  
  // Tab 4: Model Training state
  const [trainPending, setTrainPending] = useState(false);
  const [trainOutput, setTrainOutput] = useState(null);
  const [modelComparisons, setModelComparisons] = useState([]);
  const [modelCompareLoading, setModelCompareLoading] = useState(false);
  const [modelMsg, setModelMsg] = useState("");

  // Tab 5: Kaggle Samples state
  const [kaggleSamples, setKaggleSamples] = useState([]);
  const [kaggleColumnMap, setKaggleColumnMap] = useState([]);
  const [kaggleLoading, setKaggleLoading] = useState(false);
  const [activeKaggleDataset, setActiveKaggleDataset] = useState("All");
  const [expandedSample, setExpandedSample] = useState(null);

  // Refetch dataset metadata
  const fetchDatasetStatus = async () => {
    try {
      const data = await api.dataset.getStatus();
      setDatasetStatus(data);
    } catch (e) {
      setDatasetErr("Failed to pull dataset status.");
    }
  };

  useEffect(() => {
    fetchDatasetStatus();
  }, []);

  // Handle Tab switches
  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    setDatasetMsg("");
    setDatasetErr("");
    setModelMsg("");
    
    if (tab === "eda") {
      setEdaLoading(true);
      try {
        const data = await api.dataset.getEda();
        setEdaData(data);
      } catch (e) {
        setDatasetErr("Could not retrieve EDA records.");
      } finally {
        setEdaLoading(false);
      }
    } else if (tab === "features") {
      setFeatureLoading(true);
      try {
        const data = await api.dataset.getFeatures();
        setAvailableFeatures(data.features);
        setFeatureAverages(data.averages);
        if (selectedFeatures.length === 0) {
          // Select all by default
          setSelectedFeatures(data.features);
        }
      } catch (e) {
        setDatasetErr("Could not discover feature catalog.");
      } finally {
        setFeatureLoading(false);
      }
    } else if (tab === "models") {
      setModelCompareLoading(true);
      try {
        const data = await api.model.getComparisons();
        setModelComparisons(data);
      } catch (e) {
        setDatasetErr("Could not load model comparisons.");
      } finally {
        setModelCompareLoading(false);
      }
    } else if (tab === "kaggle") {
      setKaggleLoading(true);
      try {
        const [samples, colMap] = await Promise.all([
          api.dataset.getKaggleSamples(),
          api.dataset.getColumnMap()
        ]);
        setKaggleSamples(samples);
        setKaggleColumnMap(colMap);
      } catch (e) {
        setDatasetErr("Could not fetch Kaggle sample data.");
      } finally {
        setKaggleLoading(false);
      }
    }
  };

  // CSV Upload handler
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploadPending(true);
    setDatasetMsg("");
    setDatasetErr("");
    try {
      const resp = await api.dataset.upload(uploadFile);
      setDatasetMsg(resp.message);
      setUploadFile(null);
      // Reset input element
      e.target.reset();
      fetchDatasetStatus();
    } catch (err) {
      setDatasetErr(err.message || "Failed to upload file.");
    } finally {
      setUploadPending(false);
    }
  };

  // Clean / Preprocess action
  const handleRunPreprocessing = async () => {
    setPreprocessPending(true);
    setDatasetMsg("");
    setDatasetErr("");
    try {
      const resp = await api.dataset.preprocess();
      setPreprocessStats(resp);
      setDatasetMsg("Dataset clean and preprocessed successfully!");
      fetchDatasetStatus();
    } catch (err) {
      setDatasetErr(err.message || "Preprocessing pipeline error.");
    } finally {
      setPreprocessPending(false);
    }
  };

  // Feature Toggle
  const toggleFeature = (featureName) => {
    if (selectedFeatures.includes(featureName)) {
      setSelectedFeatures(prev => prev.filter(f => f !== featureName));
    } else {
      setSelectedFeatures(prev => [...prev, featureName]);
    }
  };

  // Train Models trigger
  const handleTrainModels = async () => {
    setTrainPending(true);
    setDatasetMsg("");
    setDatasetErr("");
    try {
      const resp = await api.model.train(selectedFeatures);
      setTrainOutput(resp);
      setModelMsg(`Best model selected and saved: ${resp.best_model}`);
      
      // Reload comparisons
      const comparisons = await api.model.getComparisons();
      setModelComparisons(comparisons);
    } catch (err) {
      setDatasetErr(err.message || "Model fitting failure.");
    } finally {
      setTrainPending(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Administrative Control Panel</h2>
        <p className="page-subtitle">Configure datasets, inspect EDA distributions, engineer variables, and fit classifiers.</p>
      </div>

      <div className="admin-tabs">
        <div className={`admin-tab ${activeTab === "dataset" ? "active" : ""}`} onClick={() => handleTabChange("dataset")}>
          Dataset Management
        </div>
        <div className={`admin-tab ${activeTab === "eda" ? "active" : ""}`} onClick={() => handleTabChange("eda")}>
          Exploratory Data Analysis (EDA)
        </div>
        <div className={`admin-tab ${activeTab === "features" ? "active" : ""}`} onClick={() => handleTabChange("features")}>
          Feature Engineering & Selection
        </div>
        <div className={`admin-tab ${activeTab === "models" ? "active" : ""}`} onClick={() => handleTabChange("models")}>
          Predictive Model Development
        </div>
        <div className={`admin-tab ${activeTab === "kaggle" ? "active" : ""}`} onClick={() => handleTabChange("kaggle")}>
          🔬 Kaggle Sample Inputs
        </div>
      </div>

      {datasetMsg && <div className="feedback-alert success">{datasetMsg}</div>}
      {datasetErr && <div className="feedback-alert error">{datasetErr}</div>}

      {/* TAB 1: DATASET MANAGEMENT */}
      {activeTab === "dataset" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "32px", alignItems: "start" }}>
          
          <div className="glass-card">
            <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "20px" }}>Dataset Upload (CSV)</h3>
            <form onSubmit={handleFileUpload} style={{ marginBottom: "24px" }}>
              <div className="form-group">
                <label className="form-label">Select CSV File</label>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="form-input" 
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  required
                />
              </div>
              <button type="submit" disabled={uploadPending || !uploadFile} className="btn btn-primary">
                {uploadPending ? <div className="spinner" style={{ width: "16px", height: "16px" }}></div> : (
                  <>
                    <Upload size={16} />
                    Upload File
                  </>
                )}
              </button>
            </form>

            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "24px" }}>
              <h4 style={{ fontFamily: "var(--font-heading)", marginBottom: "16px" }}>Preprocessing Actions</h4>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "16px" }}>
                Cleans the active dataset by handling missing values, encoding categoricals, scaling numeric boundaries, and executing train-test splits.
              </p>
              <button onClick={handleRunPreprocessing} disabled={preprocessPending || !datasetStatus?.active_dataset} className="btn btn-secondary">
                {preprocessPending ? <div className="spinner" style={{ width: "16px", height: "16px" }}></div> : (
                  <>
                    <Wrench size={16} />
                    Run Preprocessing Pipeline
                  </>
                )}
              </button>
            </div>

            {preprocessStats && (
              <div style={{ marginTop: "24px", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "0.9rem" }}>
                <h5 style={{ fontWeight: 700, marginBottom: "10px", color: "var(--color-primary)" }}>Preprocessing Statistics</h5>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>Total Rows: <strong>{preprocessStats.total_rows}</strong></div>
                  <div>Imputation: <strong>Median / Mode</strong></div>
                  <div>Numeric Scaling: <strong>Standard Scaler</strong></div>
                  <div>One-Hot Encoding: <strong>True</strong></div>
                </div>
              </div>
            )}
          </div>

          <div className="glass-card">
            <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "20px" }}>Current Workspace State</h3>
            {datasetStatus?.active_dataset ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Active Dataset</span>
                  <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>{datasetStatus.active_dataset.filename}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Dataset Rows</span>
                  <span style={{ fontWeight: 600 }}>{datasetStatus.active_dataset.row_count}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Pipeline Status</span>
                  <span style={{ fontWeight: 600, color: "var(--color-success)" }}>{datasetStatus.preprocessing_status}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "4px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Imported Date</span>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                    {new Date(datasetStatus.active_dataset.upload_timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--text-muted)", padding: "20px 0" }}>No datasets found. Upload one to begin.</div>
            )}

            {datasetStatus?.all_datasets?.length > 1 && (
              <div style={{ marginTop: "24px", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
                <h4 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", marginBottom: "12px" }}>Available Datasets</h4>
                <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {datasetStatus.all_datasets.map(ds => (
                    <div key={ds.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: ds.is_active ? "rgba(99, 102, 241, 0.08)" : "rgba(255,255,255,0.01)", border: "1px solid var(--border-color)", borderRadius: "6px" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: ds.is_active ? 600 : 400 }}>{ds.filename}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{ds.row_count} rows</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
        </div>
      )}

      {/* TAB 2: EXPLORATORY DATA ANALYSIS (EDA) */}
      {activeTab === "eda" && (
        <div>
          {edaLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "80px" }}>
              <div className="spinner"></div>
            </div>
          ) : edaData ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              <div className="grid-2">
                {/* 1. Loan Approval Distribution */}
                <div className="glass-card" style={{ minHeight: "360px" }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "16px", fontSize: "1.1rem" }}>Loan Approval Class Distribution</h3>
                  <div style={{ width: "100%", height: "260px" }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={edaData.approval_distribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="var(--color-success)" />
                          <Cell fill="var(--color-danger)" />
                        </Pie>
                        <Tooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="custom-tooltip">
                                <div className="tooltip-title">{payload[0].name}</div>
                                <div className="tooltip-value">{payload[0].value} Accounts</div>
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Risk Tier Distribution */}
                <div className="glass-card" style={{ minHeight: "360px" }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "16px", fontSize: "1.1rem" }}>Credit Risk Tier Distribution</h3>
                  <div style={{ width: "100%", height: "260px" }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={edaData.risk_distribution}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          <Cell fill="var(--color-success)" />
                          <Cell fill="var(--color-warning)" />
                          <Cell fill="var(--color-danger)" />
                        </Pie>
                        <Tooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="custom-tooltip">
                                <div className="tooltip-title">{payload[0].name}</div>
                                <div className="tooltip-value">{payload[0].value} Applicants</div>
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid-2">
                {/* 3. Income vs Loan Amount */}
                <div className="glass-card" style={{ minHeight: "360px" }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "16px", fontSize: "1.1rem" }}>Average Loan Request by Income Quintile</h3>
                  <div style={{ width: "100%", height: "260px" }}>
                    <ResponsiveContainer>
                      <AreaChart data={edaData.income_vs_loan}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="income" stroke="var(--text-secondary)" />
                        <YAxis stroke="var(--text-secondary)" />
                        <Tooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="custom-tooltip">
                                <div className="tooltip-title">{payload[0].payload.income} Bracket</div>
                                <div className="tooltip-value">${Math.round(payload[0].value).toLocaleString()} avg</div>
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Area type="monotone" dataKey="avg_loan" stroke="var(--color-primary)" fill="var(--color-primary-rgb)" fillOpacity={0.15} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 4. Credit Score distribution */}
                <div className="glass-card" style={{ minHeight: "360px" }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "16px", fontSize: "1.1rem" }}>Credit Score Range Histogram</h3>
                  <div style={{ width: "100%", height: "260px" }}>
                    <ResponsiveContainer>
                      <BarChart data={edaData.credit_score_distribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="range" stroke="var(--text-secondary)" />
                        <YAxis stroke="var(--text-secondary)" />
                        <Tooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="custom-tooltip">
                                <div className="tooltip-title">Score range {payload[0].payload.range}</div>
                                <div className="tooltip-value">{payload[0].value} Applicants</div>
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Bar dataKey="count" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid-2">
                {/* 5. Default rate by employment */}
                <div className="glass-card" style={{ minHeight: "360px" }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "16px", fontSize: "1.1rem" }}>Rejection Rate by Employment Status (%)</h3>
                  <div style={{ width: "100%", height: "260px" }}>
                    <ResponsiveContainer>
                      <BarChart data={edaData.default_rate_by_employment}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="status" stroke="var(--text-secondary)" />
                        <YAxis stroke="var(--text-secondary)" />
                        <Tooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="custom-tooltip">
                                <div className="tooltip-title">{payload[0].payload.status}</div>
                                <div className="tooltip-value">{payload[0].value}% Rejection Rate</div>
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Bar dataKey="rate" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 6. Correlation Heatmap */}
                <div className="glass-card" style={{ minHeight: "360px", overflow: "hidden" }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "16px", fontSize: "1.1rem" }}>Feature Correlation Heatmap</h3>
                  <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                    <table style={{ width: "100%", fontSize: "0.75rem", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "4px", borderBottom: "1px solid var(--border-color)" }}></th>
                          {edaData.correlation_heatmap.columns.slice(0, 7).map(col => (
                            <th key={col} style={{ padding: "4px", borderBottom: "1px solid var(--border-color)", transform: "rotate(-15deg)", whiteSpace: "nowrap" }}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {edaData.correlation_heatmap.columns.slice(0, 7).map((col1, rIdx) => (
                          <tr key={col1}>
                            <td style={{ fontWeight: 600, padding: "6px", borderRight: "1px solid var(--border-color)" }}>{col1}</td>
                            {edaData.correlation_heatmap.columns.slice(0, 7).map((col2, cIdx) => {
                              // Find value
                              const entry = edaData.correlation_heatmap.values.find(v => v.x === col1 && v.y === col2);
                              const val = entry ? entry.val : 0.0;
                              // Generate blue-to-red color map
                              // val is between -1 and 1
                              let bg = "rgba(255,255,255,0.01)";
                              if (val > 0) {
                                bg = `rgba(99, 102, 241, ${val * 0.45})`;
                              } else if (val < 0) {
                                bg = `rgba(239, 68, 68, ${Math.abs(val) * 0.45})`;
                              }
                              return (
                                <td key={col2} style={{ padding: "6px", textAlign: "center", background: bg, border: "1px solid rgba(255,255,255,0.03)", fontWeight: val === 1 ? 700 : 400 }}>
                                  {val}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", padding: "40px 0", textAlign: "center" }}>No active dataset to render EDA.</div>
          )}
        </div>
      )}

      {/* TAB 3: FEATURE ENGINEERING & SELECTION */}
      {activeTab === "features" && (
        <div className="glass-card">
          <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "16px" }}>Feature Engineering Catalog</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "20px" }}>
            The pipeline automatically computes three synthetic variables to expose hidden credit vulnerabilities. Check or uncheck columns to select features for model training:
          </p>
          
          {featureLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
              <div className="spinner"></div>
            </div>
          ) : (
            <div>
              <div className="feature-selection-grid">
                {availableFeatures.map(feat => {
                  const isSelected = selectedFeatures.includes(feat);
                  const isEngineered = ["Debt_to_Income_Ratio", "EMI_Burden", "Credit_Utilization"].includes(feat);
                  return (
                    <div 
                      key={feat} 
                      className={`feature-checkbox-label ${isSelected ? "selected" : ""}`}
                      onClick={() => toggleFeature(feat)}
                    >
                      <input 
                        type="checkbox" 
                        className="feature-checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by click
                      />
                      <span style={{ fontSize: "0.875rem", fontWeight: isEngineered ? 600 : 400, color: isEngineered ? "var(--color-primary)" : "inherit" }}>
                        {feat.replace(/_/g, " ")} {isEngineered && "(Eng)"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {featureAverages && (
                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "24px", marginTop: "24px" }}>
                  <h4 style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem", marginBottom: "16px" }}>Engineered Feature Workspace Averages</h4>
                  <div className="grid-3">
                    <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-color)" }}>
                      <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>Debt to Income (DTI)</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-primary)" }}>{(featureAverages.debt_to_income * 100).toFixed(1)}%</div>
                    </div>
                    <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-color)" }}>
                      <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>EMI to Income burden</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-accent)" }}>{(featureAverages.emi_burden * 100).toFixed(1)}%</div>
                    </div>
                    <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-color)" }}>
                      <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>Credit Limit Utilization</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-secondary)" }}>{(featureAverages.credit_utilization * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PREDICTIVE MODEL DEVELOPMENT */}
      {activeTab === "models" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div className="glass-card">
            <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "12px" }}>Model Training & Selection</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "20px" }}>
              Trains 4 distinct classifiers (Logistic Regression, Decision Tree, Random Forest, and XGBoost) using the selected features list, compares test performance metrics, and automatically deploys the best performing candidate.
            </p>
            {modelMsg && <div className="feedback-alert success">{modelMsg}</div>}
            
            <button onClick={handleTrainModels} disabled={trainPending} className="btn btn-primary">
              {trainPending ? <div className="spinner" style={{ width: "16px", height: "16px" }}></div> : "Fit Classifiers"}
            </button>

            {trainOutput && (
              <div style={{ marginTop: "24px", background: "rgba(255,255,255,0.01)", padding: "20px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                <h4 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", color: "var(--color-primary)", marginBottom: "16px" }}>Feature Importances (Best Model)</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {trainOutput.feature_importances.slice(0, 6).map(item => (
                    <div key={item.feature} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ width: "160px", fontSize: "0.85rem", whiteSpace: "nowrap" }}>{item.feature.replace(/_/g, " ")}</span>
                      <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ width: `${item.importance * 100}%`, background: "var(--color-primary)", height: "100%" }}></div>
                      </div>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>{(item.importance * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="glass-card">
            <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "16px" }}>Model Comparison Ledger</h3>
            {modelCompareLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
                <div className="spinner"></div>
              </div>
            ) : modelComparisons.length > 0 ? (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Algorithm Name</th>
                      <th>Accuracy</th>
                      <th>Precision</th>
                      <th>Recall</th>
                      <th>F1-Score</th>
                      <th>ROC-AUC</th>
                      <th>Depl. Status</th>
                      <th>Trained On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelComparisons.map((row) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 600 }}>{row.name}</td>
                        <td>{(row.accuracy * 100).toFixed(1)}%</td>
                        <td>{(row.precision * 100).toFixed(1)}%</td>
                        <td>{(row.recall * 100).toFixed(1)}%</td>
                        <td>{(row.f1_score * 100).toFixed(1)}%</td>
                        <td>{(row.roc_auc * 100).toFixed(1)}%</td>
                        <td>
                          {row.is_active === 1 ? (
                            <span style={{ color: "var(--color-success)", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                              Active Model
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>Standby</span>
                          )}
                        </td>
                        <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                          {new Date(row.timestamp).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                No training logs available. Trigger Fit Classifiers to see metrics.
              </div>
            )}
          </div>

        </div>
    )}

      {/* TAB 5: KAGGLE SAMPLE INPUTS */}
      {activeTab === "kaggle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

          <div className="glass-card">
            <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "8px" }}>Kaggle Sample Input Profiles</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "20px" }}>
              Six pre-built profiles derived from real Kaggle datasets. Fields are already mapped to our standard schema.
              Click any card to inspect all mapped field values.
            </p>

            {kaggleLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}><div className="spinner"></div></div>
            ) : (
              <div>
                {/* Dataset filter chips */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
                  {["All", "Loan Prediction Dataset", "Credit Risk Dataset", "German Credit Dataset"].map(ds => (
                    <button key={ds} onClick={() => setActiveKaggleDataset(ds)}
                      style={{ padding: "6px 16px", borderRadius: "20px", border: "1px solid var(--border-color)",
                        background: activeKaggleDataset === ds ? "var(--color-primary)" : "transparent",
                        color: activeKaggleDataset === ds ? "#fff" : "var(--text-secondary)",
                        cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, transition: "all 0.2s" }}
                    >{ds === "Loan Prediction Dataset" ? "Loan Prediction" : ds === "Credit Risk Dataset" ? "Credit Risk" : ds === "German Credit Dataset" ? "German Credit" : ds}</button>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
                  {kaggleSamples
                    .filter(s => activeKaggleDataset === "All" || s.kaggle_source === activeKaggleDataset)
                    .map((s, idx) => (
                      <div key={idx}
                        style={{ padding: "20px", borderRadius: "12px", border: `1px solid ${expandedSample === idx ? "var(--color-primary)" : "var(--border-color)"}`,
                          background: expandedSample === idx ? "rgba(99,102,241,0.04)" : "rgba(255,255,255,0.01)",
                          cursor: "pointer", transition: "all 0.2s" }}
                        onClick={() => setExpandedSample(expandedSample === idx ? null : idx)}
                      >
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "6px" }}>{s.label}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--color-primary)", fontWeight: 600, marginBottom: "8px" }}>
                          Source: {s.kaggle_source}
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "12px", lineHeight: 1.5 }}>{s.description}</div>

                        {/* Quick stats */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                          {[`Age: ${s.data.age}`, `Income: $${s.data.income.toLocaleString()}`,
                            `Loan: $${s.data.loan_amount.toLocaleString()}`, `Score: ${s.data.credit_score}`,
                            `Term: ${s.data.loan_term}mo`
                          ].map((tag, ti) => (
                            <span key={ti} style={{ padding: "2px 8px", borderRadius: "12px",
                              background: "rgba(99,102,241,0.1)", color: "var(--color-primary)",
                              fontSize: "0.72rem", fontWeight: 600 }}>{tag}</span>
                          ))}
                        </div>

                        {/* Expanded full field table */}
                        {expandedSample === idx && (
                          <div style={{ marginTop: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                            <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
                              <tbody>
                                {Object.entries(s.data).map(([field, val]) => (
                                  <tr key={field}>
                                    <td style={{ padding: "4px 8px", color: "var(--text-secondary)", fontWeight: 600, textTransform: "capitalize", width: "50%" }}>
                                      {field.replace(/_/g, " ")}
                                    </td>
                                    <td style={{ padding: "4px 8px", color: "var(--text-primary)", fontFamily: typeof val === "number" ? "monospace" : "inherit" }}>
                                      {typeof val === "number" ? val.toLocaleString() : val}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div style={{ marginTop: "10px", fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "right" }}>
                          {expandedSample === idx ? "▲ Collapse" : "▼ Expand all fields"}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Column Mapping Reference */}
          <div className="glass-card">
            <h3 style={{ fontFamily: "var(--font-heading)", marginBottom: "8px" }}>Auto-Mapping Reference Table</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "20px" }}>
              When any Kaggle CSV is uploaded, the backend pipeline detects these column aliases and automatically renames
              and transforms them into our standard 13-column schema before saving.
            </p>
            {kaggleLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}><div className="spinner"></div></div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Kaggle Original Column</th>
                      <th>→ Mapped To (Standard Field)</th>
                      <th>Dataset Source</th>
                      <th>Transformation Applied</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kaggleColumnMap.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: "monospace", color: "var(--color-accent)", fontSize: "0.85rem" }}>{row.kaggle}</td>
                        <td style={{ fontWeight: 700 }}>{row.ours}</td>
                        <td>
                          <span style={{
                            padding: "2px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700,
                            background: row.dataset === "Loan Prediction" ? "rgba(99,102,241,0.1)" : row.dataset === "Credit Risk" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                            color: row.dataset === "Loan Prediction" ? "var(--color-primary)" : row.dataset === "Credit Risk" ? "var(--color-success)" : "var(--color-warning)"
                          }}>{row.dataset}</span>
                        </td>
                        <td style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                          {row.ours.includes("added") ? "Summed with ApplicantIncome" :
                           row.ours.includes("450/750") ? "Binary 0→450, 1→750 credit score" :
                           row.ours.includes("derived") ? "Length multiplied by score factor" :
                           row.ours.includes("/12") ? "Annual ÷ 12 = Monthly" :
                           row.ours.includes("inferred") ? "Low savings → high inferred debt" :
                           "Direct rename"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// APP SHELL AND ROOT ROUTER
// ----------------------------------------------------
function AppContent() {
  const { user } = useAuth();
  
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/predict" element={<RequireAuth><PredictPage /></RequireAuth>} />
          <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth role="admin"><AdminPanelPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
