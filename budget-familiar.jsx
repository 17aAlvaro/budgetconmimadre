import { useState, useEffect, useMemo } from "react";
import { supabase } from "./src/lib/supabaseClient";
// ─────────────────────────────────────────────
//  CONSTANTES
// ─────────────────────────────────────────────
const CATS = {
  income: [
    { id: "nomina", label: "Nómina", icon: "💼", color: "#0ECB81" },
    { id: "nomina2", label: "Nómina pareja", icon: "💼", color: "#0ECB81" },
    { id: "extra", label: "Ingresos extra", icon: "⚡", color: "#F0B90B" },
    { id: "freelance", label: "Freelance", icon: "🖥️", color: "#7B61FF" },
    { id: "inversion", label: "Inversiones", icon: "📈", color: "#26A17B" },
    { id: "alquiler", label: "Alquiler cobrado", icon: "🏘️", color: "#0ECB81" },
    { id: "subsidio", label: "Ayuda / Subsidio", icon: "🏛️", color: "#61A8FF" },
    { id: "otro_in", label: "Otro ingreso", icon: "➕", color: "#888" },
  ],
  expense: [
    { id: "hipoteca", label: "Hipoteca / Alquiler", icon: "🏠", color: "#F6465D" },
    { id: "comunidad", label: "Comunidad / IBI", icon: "🏢", color: "#F6465D" },
    { id: "suministros", label: "Luz / Agua / Gas", icon: "💡", color: "#F0B90B" },
    { id: "internet", label: "Internet / Móvil", icon: "📡", color: "#F0B90B" },
    { id: "super", label: "Supermercado", icon: "🛒", color: "#FF8C00" },
    { id: "restaurante", label: "Restaurantes", icon: "🍽️", color: "#FF8C00" },
    { id: "gasolina", label: "Gasolina", icon: "⛽", color: "#61A8FF" },
    { id: "transporte", label: "Transporte público", icon: "🚇", color: "#61A8FF" },
    { id: "coche", label: "Seguro / Coche", icon: "🚗", color: "#61A8FF" },
    { id: "salud", label: "Salud / Farmacia", icon: "💊", color: "#0ECB81" },
    { id: "gimnasio", label: "Gimnasio", icon: "🏋️", color: "#0ECB81" },
    { id: "educacion", label: "Educación", icon: "📚", color: "#7B61FF" },
    { id: "ropa", label: "Ropa", icon: "👗", color: "#FF6B9D" },
    { id: "ocio", label: "Ocio / Entretenimiento", icon: "🎬", color: "#F0B90B" },
    { id: "viajes", label: "Viajes", icon: "✈️", color: "#61A8FF" },
    { id: "suscripciones", label: "Suscripciones", icon: "📱", color: "#7B61FF" },
    { id: "seguros", label: "Seguros", icon: "🛡️", color: "#888" },
    { id: "credito", label: "Crédito / Préstamo", icon: "🏦", color: "#F6465D" },
    { id: "ahorro", label: "Ahorro", icon: "💰", color: "#0ECB81" },
    { id: "inversion_g", label: "Inversión", icon: "📊", color: "#26A17B" },
    { id: "impuestos", label: "Impuestos / Tasas", icon: "📋", color: "#F6465D" },
    { id: "mascotas", label: "Mascotas", icon: "🐾", color: "#FF8C00" },
    { id: "hogar", label: "Hogar / Muebles", icon: "🛋️", color: "#888" },
    { id: "regalos", label: "Regalos", icon: "🎁", color: "#FF6B9D" },
    { id: "otro_ex", label: "Otro gasto", icon: "📤", color: "#555" },
  ],
};

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const ALL_CATS = [...CATS.income, ...CATS.expense];
const getCat = (id) => ALL_CATS.find((c) => c.id === id) || { label: id, icon: "•", color: "#888" };
const mkey = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
const fmt = (n, dec = 0) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR",
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  }).format(n || 0);
const fmtPct = (n) => (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const todayISO = () => new Date().toISOString().split("T")[0];

// ─────────────────────────────────────────────
//  PERSISTENCIA  (localStorage + backup JSON)
// ─────────────────────────────────────────────
const LS_DATA = "budget_rev_data_v1";
const LS_GOALS = "budget_rev_goals_v1";

function lsLoad(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function lsSave(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
}

// Exportar todo a JSON y forzar descarga
function exportBackup(data, goals) {
  const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data, goals }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `presupuesto_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Importar desde JSON
function importBackup(file, onSuccess, onError) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.data) throw new Error("Formato inválido");
      onSuccess(parsed.data, parsed.goals || {});
    } catch (err) {
      onError(err.message);
    }
  };
  reader.readAsText(file);
}

// ─────────────────────────────────────────────
//  SUBCOMPONENTES
// ─────────────────────────────────────────────

/** Sparkline SVG */
function Spark({ data = [], color = "#0ECB81", width = 80, height = 28 }) {
  const nonzero = data.filter((v) => v > 0);
  if (nonzero.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * height * 0.85 - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} style={{ overflow: "visible", display: "block" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Donut chart SVG */
function Donut({ segments = [], size = 110 }) {
  const r = 38;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1C1C2E" strokeWidth="12" />
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circ;
        const gap = circ - dash;
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="12"
            strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`}
            strokeDashoffset={(-offset * circ).toFixed(2)}
            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
          />
        );
        offset += pct;
        return el;
      })}
    </svg>
  );
}

/** Bar chart anual */
function BarChart({ data = [], currentMonth = 0 }) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1);
  const H = 72;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: H + 20 }}>
      {data.map((d, i) => {
        const isCur = i === currentMonth;
        const incH = (d.income / maxVal) * H;
        const expH = (d.expense / maxVal) * H;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: H }}>
              <div style={{ width: 5, height: Math.max(incH, 1), background: isCur ? "#0ECB81" : "#0ECB8133", borderRadius: "2px 2px 0 0" }} />
              <div style={{ width: 5, height: Math.max(expH, 1), background: isCur ? "#F6465D" : "#F6465D33", borderRadius: "2px 2px 0 0" }} />
            </div>
            <div style={{ fontSize: 8, color: isCur ? "#fff" : "#444", fontWeight: isCur ? 700 : 400 }}>
              {MONTHS_SHORT[i]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Toast */
function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
      background: "#1C1C2E", border: "1px solid #2A2A45", borderRadius: 12,
      padding: "10px 20px", fontSize: 13, color: "#fff", zIndex: 9999,
      whiteSpace: "nowrap", boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      pointerEvents: "none",
    }}>
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────
//  ESTILOS BASE
// ─────────────────────────────────────────────
const S = {
  app: { background: "#0A0A0F", minHeight: "100vh", color: "#fff", fontFamily: "'Inter', -apple-system, sans-serif", paddingBottom: 80 },
  card: { background: "#13131F", borderRadius: 16, padding: "16px 18px", marginBottom: 12 },
  cardDk: { background: "#0D0D1A", borderRadius: 16, padding: "16px 18px", marginBottom: 12, border: "1px solid #1E1E35" },
  section: { fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 500 },
  input: { width: "100%", background: "#1C1C2E", border: "1px solid #2A2A45", borderRadius: 10, color: "#fff", padding: "11px 14px", fontSize: 14, boxSizing: "border-box", outline: "none" },
  pill: (active, color = "#7B61FF") => ({
    padding: "4px 12px", borderRadius: 20,
    border: `1px solid ${active ? color : "#222"}`,
    background: active ? color + "22" : "transparent",
    color: active ? color : "#666",
    fontSize: 12, cursor: "pointer", fontWeight: active ? 600 : 400, whiteSpace: "nowrap",
  }),
  tabBtn: (active) => ({
    flex: 1, padding: "10px 4px", background: "none", border: "none",
    color: active ? "#fff" : "#444", fontSize: 11, cursor: "pointer",
    fontWeight: active ? 700 : 400, letterSpacing: "0.03em",
  }),
  badge: (color) => ({
    display: "inline-block", padding: "2px 7px", borderRadius: 8,
    background: color + "22", color, fontSize: 11, fontWeight: 600,
  }),
  btn: (col = "#7B61FF") => ({
    background: col, border: "none", borderRadius: 10, color: "#fff",
    padding: "13px 20px", fontSize: 15, fontWeight: 600, cursor: "pointer", width: "100%",
  }),
};

// ─────────────────────────────────────────────
//  APP PRINCIPAL
// ─────────────────────────────────────────────
export default function App() {
  const now = new Date();

  // ── estado global ──
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [tab, setTab] = useState("home");
  const [data, setData] = useState(() => lsLoad(LS_DATA, {}));
  const [goals, setGoals] = useState(() => lsLoad(LS_GOALS, {}));
  useEffect(() => {
    async function loadTransactions() {
      const { data: rows, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false });

      if (error) {
        console.error("Error cargando movimientos desde Supabase:", error);
        return;
      }

      const grouped = {};

      rows.forEach((item) => {
        const key = item.date.slice(0, 7);

        if (!grouped[key]) {
          grouped[key] = [];
        }

        grouped[key].push({
          id: item.id,
          type: item.type,
          category: item.category,
          amount: Number(item.amount),
          description: item.description || "",
          date: item.date,
          person: item.person || "",
          note: item.note || "",
          recurring: item.recurring || false,
          tags: item.tags || [],
        });
      });

      setData(grouped);
    }

    loadTransactions();
  }, []);

  // ── formulario ──
  const emptyForm = { type: "expense", category: "super", amount: "", description: "", date: todayISO(), note: "", recurring: false, tags: "" };
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // ── filtros movimientos ──
  const [filterType, setFilterType] = useState("all");
  const [filterCat, setFilterCat] = useState("all");

  // ── ui ──
  const [toast, setToast] = useState(null);
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [importError, setImportError] = useState("");

  // persistencia automática
  useEffect(() => { lsSave(LS_DATA, data); }, [data]);
  useEffect(() => { lsSave(LS_GOALS, goals); }, [goals]);

  function showToast(msg, ms = 2500) {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }

  // ── datos del mes actual ──
  const key = mkey(year, month);
  const entries = useMemo(() => data[key] || [], [data, key]);

  const totals = useMemo(() => {
    const income = entries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return { income, expense, balance: income - expense, txCount: entries.length };
  }, [entries]);

  const byCat = useMemo(() => {
    const m = {};
    entries.forEach((e) => { m[e.category] = (m[e.category] || 0) + e.amount; });
    return m;
  }, [entries]);

  // gasto por día del mes
  const dailySpend = useMemo(() => {
    const days = new Date(year, month + 1, 0).getDate();
    const byDay = {};
    entries.forEach((e) => {
      if (e.type !== "expense") return;
      const d = (e.date || "").slice(8, 10) || "01";
      byDay[d] = (byDay[d] || 0) + e.amount;
    });
    return Array.from({ length: days }, (_, i) => byDay[String(i + 1).padStart(2, "0")] || 0);
  }, [entries, year, month]);

  // datos anuales
  const annualData = useMemo(() =>
    Array.from({ length: 12 }, (_, m) => {
      const k = mkey(year, m);
      const es = data[k] || [];
      const income = es.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
      const expense = es.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
      return { income, expense, balance: income - expense };
    }),
    [data, year]);

  // mes anterior
  const prevKey = mkey(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);
  const prevEntries = data[prevKey] || [];
  const prevIncome = prevEntries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const prevExpense = prevEntries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const incomeVsPrev = prevIncome > 0 ? ((totals.income - prevIncome) / prevIncome * 100) : null;
  const expenseVsPrev = prevExpense > 0 ? ((totals.expense - prevExpense) / prevExpense * 100) : null;

  const avgMonthlyExpense = useMemo(() => {
    const months = annualData.filter((m) => m.expense > 0);
    return months.length ? months.reduce((s, m) => s + m.expense, 0) / months.length : 0;
  }, [annualData]);

  const totalAnnualSaved = annualData.reduce((s, m) => s + Math.max(0, m.balance), 0);
  const annualGoal = goals["_annual"] || 0;
  const annualProgress = annualGoal > 0 ? clamp((totalAnnualSaved / annualGoal) * 100, 0, 100) : 0;
  const savingsRate = totals.income > 0 ? (totals.balance / totals.income) * 100 : 0;

  const expenseByType = CATS.expense.filter((c) => byCat[c.id] > 0).sort((a, b) => (byCat[b.id] || 0) - (byCat[a.id] || 0));
  const incomeByType = CATS.income.filter((c) => byCat[c.id] > 0).sort((a, b) => (byCat[b.id] || 0) - (byCat[a.id] || 0));
  const donutSegs = expenseByType.slice(0, 6).map((c) => ({ value: byCat[c.id] || 0, color: c.color }));

  const bestMonth = annualData.reduce((b, m, i) => m.income > 0 && m.balance > (b ? b.balance : -Infinity) ? { ...m, i } : b, null);
  const worstMonth = annualData.reduce((b, m, i) => m.expense > 0 && m.balance < (b ? b.balance : Infinity) ? { ...m, i } : b, null);

  const daysLeft = Math.max(1, new Date(year, month + 1, 0).getDate() - now.getDate());
  const dailyBudgetLeft = totals.balance / daysLeft;
  const spentToday = dailySpend[now.getDate() - 1] || 0;
  const avgDailySpend = totals.expense / Math.max(1, now.getDate());

  // filtrado de movimientos
  const filtered = useMemo(() => {
    let es = [...entries].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (filterType !== "all") es = es.filter((e) => e.type === filterType);
    if (filterCat !== "all") es = es.filter((e) => e.category === filterCat);
    return es;
  }, [entries, filterType, filterCat]);

  // ── navegación mes ──
  function changeMonth(dir) {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  }

  // ── formulario ──
  function openAdd() {
    setForm(emptyForm); setEditId(null); setShowForm(true);
  }
  function openEdit(item) {
    setForm({
      type: item.type, category: item.category,
      amount: String(item.amount), description: item.description || "",
      date: item.date || todayISO(), note: item.note || "",
      recurring: item.recurring || false,
      tags: (item.tags || []).join(", "),
    });
    setEditId(item.id); setShowForm(true);
  }
  async function submitForm() {
    const amount = parseFloat(form.amount);

    if (!amount || amount <= 0 || !form.date) return;

    const item = {
      id: editId || Date.now(),
      type: form.type,
      category: form.category,
      amount,
      description: form.description,
      date: form.date,
      note: form.note,
      recurring: form.recurring,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    try {
      if (editId) {
        // EDITAR MOVIMIENTO
        const { error } = await supabase
          .from("transactions")
          .update({
            type: item.type,
            category: item.category,
            amount: item.amount,
            description: item.description,
            date: item.date,
            note: item.note,
            recurring: item.recurring,
            tags: item.tags,
          })
          .eq("id", editId);

        if (error) throw error;

      } else {
        // CREAR MOVIMIENTO
        const { error } = await supabase
          .from("transactions")
          .insert([item]);

        if (error) throw error;
      }

      // Actualizar la interfaz
      setData((prev) => {
        const es = prev[key] || [];

        const upd = editId
          ? es.map((e) => (e.id === editId ? item : e))
          : [...es, item];

        return { ...prev, [key]: upd };
      });

      setShowForm(false);
      showToast(editId ? "Movimiento actualizado ✓" : "Movimiento añadido ✓");

    } catch (error) {
      console.error("Error guardando movimiento en Supabase:", error);
      showToast("Error guardando el movimiento");
    }
  }
  async function deleteItem(id) {
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setData((prev) => ({
        ...prev,
        [key]: (prev[key] || []).filter((e) => e.id !== id),
      }));

      showToast("Eliminado ✓");

    } catch (error) {
      console.error("Error eliminando movimiento de Supabase:", error);
      showToast("Error eliminando el movimiento");
    }
  }

  // ── importar backup ──
  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    importBackup(
      file,
      (importedData, importedGoals) => {
        setData(importedData);
        setGoals(importedGoals);
        showToast("Backup restaurado correctamente ✓");
        setImportError("");
      },
      (msg) => setImportError("Error al importar: " + msg),
    );
    e.target.value = "";
  }

  // ─────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────
  return (
    <div style={S.app}>
      <Toast message={toast} />

      {/* ══ HERO CARD ══════════════════════════════════════════════════════ */}
      <div style={{
        background: "linear-gradient(135deg,#1A0533 0%,#0D0D28 50%,#001A33 100%)",
        padding: "24px 20px 20px", position: "relative", overflow: "hidden",
      }}>
        {/* decoración fondo */}
        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle,#7B61FF18 0%,transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -40, left: -40, width: 150, height: 150, borderRadius: "50%", background: "radial-gradient(circle,#0ECB8115 0%,transparent 70%)" }} />

        {/* fila superior */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, position: "relative" }}>
          <div>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Presupuesto familiar</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => changeMonth(-1)} style={{ background: "#ffffff10", border: "none", color: "#888", width: 26, height: 26, borderRadius: 7, cursor: "pointer", fontSize: 15 }}>‹</button>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#ccc", minWidth: 130, textAlign: "center" }}>{MONTHS[month]} {year}</span>
              <button onClick={() => changeMonth(1)} style={{ background: "#ffffff10", border: "none", color: "#888", width: 26, height: 26, borderRadius: 7, cursor: "pointer", fontSize: 15 }}>›</button>
            </div>
          </div>
          <button onClick={openAdd} style={{ background: "#7B61FF", border: "none", borderRadius: 12, color: "#fff", padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + Añadir
          </button>
        </div>

        {/* balance hero */}
        <div style={{ textAlign: "center", marginBottom: 20, position: "relative" }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Balance del mes</div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.02em", color: totals.balance >= 0 ? "#0ECB81" : "#F6465D", lineHeight: 1 }}>
            {fmt(totals.balance, 2)}
          </div>
          <div style={{ fontSize: 11, color: "#444", marginTop: 8 }}>
            {totals.txCount} movimientos · tasa de ahorro {savingsRate.toFixed(0)}%
          </div>
        </div>

        {/* ingresos / gastos */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, position: "relative" }}>
          {[
            { label: "Ingresos", val: totals.income, prev: incomeVsPrev, color: "#0ECB81", good: (p) => p >= 0 },
            { label: "Gastos", val: totals.expense, prev: expenseVsPrev, color: "#F6465D", good: (p) => p <= 0 },
          ].map((c) => (
            <div key={c.label} style={{ background: "#ffffff08", borderRadius: 12, padding: "12px 14px", border: "1px solid #ffffff08" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "#666", fontWeight: 600 }}>{c.label}</span>
                {c.prev !== null && (
                  <span style={{ fontSize: 10, color: c.good(c.prev) ? "#0ECB81" : "#F6465D", fontWeight: 700 }}>
                    {fmtPct(c.prev)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{fmt(c.val)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ CONTENIDO POR PESTAÑA ═════════════════════════════════════════ */}
      <div style={{ padding: "0 16px" }}>

        {/* ── HOME ─────────────────────────────────────────────────────── */}
        {tab === "home" && (
          <div style={{ paddingTop: 16 }}>

            {/* métricas rápidas */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[
                { label: "Gasto hoy", val: fmt(spentToday), sub: "día actual" },
                { label: "Media diaria", val: fmt(avgDailySpend), sub: "este mes" },
                { label: "Disponible/día", val: dailyBudgetLeft > 0 ? fmt(dailyBudgetLeft) : "—", sub: `${daysLeft}d restantes`, col: dailyBudgetLeft > 0 ? "#0ECB81" : "#F6465D" },
              ].map((s) => (
                <div key={s.label} style={{ ...S.card, padding: "12px", marginBottom: 0, textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: s.col || "#fff" }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* sparkline gasto diario */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={S.section}>Gasto diario — {MONTHS[month]}</div>
                <div style={{ fontSize: 11, color: "#555" }}>total {fmt(totals.expense)}</div>
              </div>
              <Spark data={dailySpend} color="#F6465D" width={620} height={40} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 9, color: "#333" }}>1</span>
                <span style={{ fontSize: 9, color: "#333" }}>{new Date(year, month + 1, 0).getDate()}</span>
              </div>
            </div>

            {/* bar chart anual */}
            <div style={S.card}>
              <div style={S.section}>Evolución anual {year}</div>
              <BarChart data={annualData} currentMonth={month} />
              <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                <span style={{ fontSize: 10, color: "#0ECB81" }}>▌ Ingresos</span>
                <span style={{ fontSize: 10, color: "#F6465D" }}>▌ Gastos</span>
                <span style={{ fontSize: 10, color: "#555" }}>Ahorrado: {fmt(totalAnnualSaved)}</span>
              </div>
            </div>

            {/* objetivo anual */}
            {annualGoal > 0 && (
              <div style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={S.section}>Objetivo de ahorro {year}</div>
                  <span style={{ fontSize: 11, color: "#7B61FF", fontWeight: 700 }}>{annualProgress.toFixed(0)}%</span>
                </div>
                <div style={{ height: 6, background: "#1C1C2E", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${annualProgress}%`, background: "linear-gradient(90deg,#7B61FF,#0ECB81)", borderRadius: 3, transition: "width .5s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "#666" }}>{fmt(totalAnnualSaved)} ahorrados</span>
                  <span style={{ color: "#444" }}>meta {fmt(annualGoal)}</span>
                </div>
              </div>
            )}

            {/* top categorías gasto */}
            {expenseByType.length > 0 && (
              <div style={S.card}>
                <div style={S.section}>Top categorías de gasto</div>
                {expenseByType.slice(0, 6).map((cat) => {
                  const amt = byCat[cat.id] || 0;
                  const pct = totals.expense > 0 ? (amt / totals.expense) * 100 : 0;
                  const goalAmt = goals[cat.id] || 0;
                  const overGoal = goalAmt > 0 && amt > goalAmt;
                  return (
                    <div key={cat.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 15 }}>{cat.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{cat.label}</span>
                          {overGoal && <span style={{ fontSize: 9, background: "#F6465D22", color: "#F6465D", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>LÍMITE</span>}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: overGoal ? "#F6465D" : cat.color }}>{fmt(amt)}</div>
                          <div style={{ fontSize: 9, color: "#444" }}>{pct.toFixed(0)}%{goalAmt > 0 ? ` / ${fmt(goalAmt)}` : ""}</div>
                        </div>
                      </div>
                      <div style={{ height: 3, background: "#1C1C2E", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: overGoal ? "#F6465D" : cat.color, borderRadius: 2, opacity: 0.7 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* fuentes de ingreso */}
            {incomeByType.length > 0 && (
              <div style={S.card}>
                <div style={S.section}>Fuentes de ingreso</div>
                {incomeByType.map((cat) => {
                  const amt = byCat[cat.id] || 0;
                  const pct = totals.income > 0 ? (amt / totals.income) * 100 : 0;
                  return (
                    <div key={cat.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #1A1A2E" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{cat.icon}</span>
                        <div>
                          <div style={{ fontSize: 13 }}>{cat.label}</div>
                          <div style={{ fontSize: 10, color: "#555" }}>{pct.toFixed(0)}% del total</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0ECB81" }}>+{fmt(amt)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {entries.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#333" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
                <div style={{ fontSize: 14, color: "#444" }}>Sin movimientos en {MONTHS[month]}</div>
                <div style={{ fontSize: 12, color: "#333", marginTop: 4 }}>Pulsa "+ Añadir" para empezar</div>
              </div>
            )}
          </div>
        )}

        {/* ── MOVIMIENTOS ──────────────────────────────────────────────── */}
        {tab === "txns" && (
          <div style={{ paddingTop: 16 }}>
            {/* filtros tipo */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", paddingBottom: 2 }}>
              {[["all", "Todo"], ["income", "Ingresos"], ["expense", "Gastos"]].map(([v, l]) => (
                <button key={v} onClick={() => setFilterType(v)} style={S.pill(filterType === v)}>{l}</button>
              ))}
            </div>
            {/* filtros categoría */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
              <button onClick={() => setFilterCat("all")} style={S.pill(filterCat === "all")}>Todas</button>
              {ALL_CATS.filter((c) => byCat[c.id]).map((c) => (
                <button key={c.id} onClick={() => setFilterCat(c.id)} style={S.pill(filterCat === c.id, c.color)}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>

            {/* resumen filtrado */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[
                { label: "Registros", val: String(filtered.length), col: "#fff" },
                { label: "Entradas", val: fmt(filtered.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0)), col: "#0ECB81" },
                { label: "Salidas", val: fmt(filtered.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0)), col: "#F6465D" },
              ].map((s) => (
                <div key={s.label} style={{ ...S.cardDk, padding: "10px 12px", marginBottom: 0 }}>
                  <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.col }}>{s.val}</div>
                </div>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#333", fontSize: 13 }}>Sin movimientos aquí</div>
            ) : filtered.map((item) => {
              const cat = getCat(item.category);
              return (
                <div key={item.id} style={{ ...S.card, display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }} onClick={() => openEdit(item)}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: cat.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {cat.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.description || cat.label}
                    </div>
                    <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: "#555" }}>{item.date}</span>
                      <span style={S.badge(cat.color)}>{cat.label}</span>
                      {item.recurring && <span style={S.badge("#F0B90B")}>↺ recurrente</span>}
                      {(item.tags || []).map((t) => <span key={t} style={{ fontSize: 9, color: "#555" }}>#{t}</span>)}
                    </div>
                    {item.note && <div style={{ fontSize: 10, color: "#444", marginTop: 2, fontStyle: "italic" }}>{item.note}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: item.type === "income" ? "#0ECB81" : "#F6465D" }}>
                      {item.type === "income" ? "+" : "-"}{fmt(item.amount, 2)}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                      style={{ background: "none", border: "none", color: "#333", fontSize: 11, cursor: "pointer", padding: 0, marginTop: 2 }}
                    >
                      eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── ANÁLISIS ─────────────────────────────────────────────────── */}
        {tab === "analytics" && (
          <div style={{ paddingTop: 16 }}>

            {/* resumen anual */}
            <div style={S.card}>
              <div style={S.section}>Resumen anual {year}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Total ingresos", val: fmt(annualData.reduce((s, m) => s + m.income, 0)), color: "#0ECB81" },
                  { label: "Total gastos", val: fmt(annualData.reduce((s, m) => s + m.expense, 0)), color: "#F6465D" },
                  { label: "Total ahorrado", val: fmt(totalAnnualSaved), color: "#7B61FF" },
                  { label: "Media mensual gasto", val: fmt(avgMonthlyExpense), color: "#F0B90B" },
                  { label: "Mejor mes", val: bestMonth ? MONTHS_SHORT[bestMonth.i] : "—", color: "#0ECB81" },
                  { label: "Peor mes", val: worstMonth ? MONTHS_SHORT[worstMonth.i] : "—", color: "#F6465D" },
                ].map((m) => (
                  <div key={m.label} style={{ background: "#0D0D1A", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", marginBottom: 3 }}>{m.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* donut */}
            {donutSegs.length > 0 && (
              <div style={S.card}>
                <div style={S.section}>Distribución de gastos — {MONTHS[month]}</div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <Donut segments={donutSegs} size={110} />
                  <div style={{ flex: 1 }}>
                    {expenseByType.slice(0, 6).map((cat) => {
                      const pct = totals.expense > 0 ? ((byCat[cat.id] || 0) / totals.expense) * 100 : 0;
                      return (
                        <div key={cat.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: cat.color }} />
                            <span style={{ fontSize: 11, color: "#aaa" }}>{cat.label}</span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700 }}>{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* tabla mensual */}
            <div style={S.card}>
              <div style={S.section}>Tabla mensual {year}</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1A1A2E" }}>
                      {["Mes", "Ingresos", "Gastos", "Balance", "Ahorro%"].map((h) => (
                        <th key={h} style={{ padding: "6px 4px", color: "#555", fontWeight: 600, textAlign: h === "Mes" ? "left" : "right", fontSize: 10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {annualData.map((row, i) => {
                      const isCur = i === month;
                      const rate = row.income > 0 ? (row.balance / row.income) * 100 : 0;
                      return (
                        <tr key={i} onClick={() => { setMonth(i); setTab("home"); }} style={{ borderBottom: "1px solid #0F0F1A", cursor: "pointer", background: isCur ? "#7B61FF11" : "transparent" }}>
                          <td style={{ padding: "7px 4px", fontWeight: isCur ? 700 : 400, color: isCur ? "#7B61FF" : "#ccc" }}>{MONTHS_SHORT[i]}</td>
                          <td style={{ padding: "7px 4px", textAlign: "right", color: "#0ECB81" }}>{row.income > 0 ? fmt(row.income) : "—"}</td>
                          <td style={{ padding: "7px 4px", textAlign: "right", color: "#F6465D" }}>{row.expense > 0 ? fmt(row.expense) : "—"}</td>
                          <td style={{ padding: "7px 4px", textAlign: "right", fontWeight: 600, color: row.balance >= 0 ? "#0ECB81" : "#F6465D" }}>
                            {(row.income > 0 || row.expense > 0) ? fmt(row.balance) : "—"}
                          </td>
                          <td style={{ padding: "7px 4px", textAlign: "right", color: rate >= 20 ? "#0ECB81" : rate >= 0 ? "#F0B90B" : "#F6465D" }}>
                            {row.income > 0 ? rate.toFixed(0) + "%" : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* evolución por categoría */}
            {expenseByType.length > 0 && (
              <div style={S.card}>
                <div style={S.section}>Evolución por categoría (año)</div>
                {expenseByType.slice(0, 8).map((cat) => {
                  const sparkData = Array.from({ length: 12 }, (_, mi) => {
                    const k = mkey(year, mi);
                    const es = data[k] || [];
                    return es.filter((e) => e.category === cat.id).reduce((s, e) => s + e.amount, 0);
                  });
                  return (
                    <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid #0F0F1A" }}>
                      <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{cat.icon}</span>
                      <span style={{ fontSize: 12, flex: 1, color: "#aaa" }}>{cat.label}</span>
                      <Spark data={sparkData} color={cat.color} width={70} height={20} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: cat.color, minWidth: 55, textAlign: "right" }}>{fmt(byCat[cat.id] || 0)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── AJUSTES ──────────────────────────────────────────────────── */}
        {tab === "settings" && (
          <div style={{ paddingTop: 16 }}>

            {/* objetivo anual */}
            <div style={S.card}>
              <div style={S.section}>Objetivo de ahorro anual</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  value={goalInput || annualGoal || ""}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder="Ej: 6000"
                  style={S.input}
                />
                <button
                  onClick={() => {
                    const v = parseFloat(goalInput) || 0;
                    setGoals((g) => ({ ...g, _annual: v }));
                    setGoalInput("");
                    showToast("Objetivo guardado ✓");
                  }}
                  style={{ ...S.btn("#7B61FF"), width: "auto", padding: "11px 16px", fontSize: 13, whiteSpace: "nowrap" }}
                >
                  Guardar
                </button>
              </div>
            </div>

            {/* límites por categoría */}
            <div style={S.card}>
              <div style={S.section}>Límites de gasto por categoría</div>
              <div style={{ fontSize: 11, color: "#444", marginBottom: 12 }}>Se muestra una alerta en rojo cuando superas el límite</div>
              {CATS.expense.map((cat) => (
                <div key={cat.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, width: 22, textAlign: "center" }}>{cat.icon}</span>
                  <span style={{ fontSize: 12, flex: 1, color: "#aaa" }}>{cat.label}</span>
                  <input
                    type="number"
                    defaultValue={goals[cat.id] || ""}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      setGoals((g) => ({ ...g, [cat.id]: v }));
                    }}
                    placeholder="€"
                    style={{ ...S.input, width: 80, padding: "6px 10px", fontSize: 13 }}
                  />
                </div>
              ))}
            </div>

            {/* ── BACKUP ── */}
            <div style={S.card}>
              <div style={S.section}>Copia de seguridad</div>
              <p style={{ fontSize: 12, color: "#555", marginTop: 0, marginBottom: 14, lineHeight: 1.6 }}>
                Los datos se guardan automáticamente en el navegador. Haz un backup en JSON periódicamente para no perder nada si cambias de dispositivo o limpias el navegador.
              </p>

              {/* exportar */}
              <button
                onClick={() => { exportBackup(data, goals); showToast("Backup exportado ✓"); }}
                style={{ ...S.btn("#26A17B"), marginBottom: 10, fontSize: 14 }}
              >
                📤 Exportar backup JSON
              </button>

              {/* importar */}
              <label style={{ display: "block", background: "#1C1C2E", border: "1px dashed #2A2A45", borderRadius: 10, padding: "13px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "center", color: "#7B61FF", marginBottom: 4 }}>
                📥 Importar backup JSON
                <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
              </label>
              {importError && <div style={{ fontSize: 11, color: "#F6465D", marginTop: 6 }}>{importError}</div>}
              <p style={{ fontSize: 11, color: "#333", marginTop: 8 }}>Al importar se sobreescribirán todos los datos actuales.</p>

              {/* borrar mes */}
              <div style={{ borderTop: "1px solid #1A1A2E", paddingTop: 14, marginTop: 6 }}>
                <button
                  onClick={() => {
                    if (window.confirm(`¿Eliminar todos los movimientos de ${MONTHS[month]} ${year}?`)) {
                      setData((p) => ({ ...p, [key]: [] }));
                      showToast("Mes borrado");
                    }
                  }}
                  style={{ ...S.btn("transparent"), border: "1px solid #F6465D33", color: "#F6465D", fontSize: 13 }}
                >
                  🗑️ Borrar mes actual ({MONTHS[month]})
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ BOTTOM NAV ════════════════════════════════════════════════════ */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0A0A0F", borderTop: "1px solid #1A1A2E", display: "flex", padding: "6px 0 4px", zIndex: 50 }}>
        {[
          { id: "home", icon: "⊞", label: "Inicio" },
          { id: "txns", icon: "↕", label: "Gastos" },
          { id: "analytics", icon: "◎", label: "Análisis" },
          { id: "settings", icon: "◈", label: "Ajustes" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={S.tabBtn(tab === t.id)}>
            <div style={{ fontSize: 18, marginBottom: 1 }}>{t.icon}</div>
            <div style={{ fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t.label}</div>
            {tab === t.id && <div style={{ width: 16, height: 2, background: "#7B61FF", borderRadius: 1, margin: "2px auto 0" }} />}
          </button>
        ))}
      </div>

      {/* ══ MODAL FORMULARIO ══════════════════════════════════════════════ */}
      {showForm && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 200, display: "flex", alignItems: "flex-end" }}
          onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
        >
          <div style={{ background: "#13131F", borderRadius: "20px 20px 0 0", padding: "20px 20px 36px", width: "100%", maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }}>
            {/* handle */}
            <div style={{ width: 36, height: 4, background: "#2A2A45", borderRadius: 2, margin: "0 auto 20px" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{editId ? "Editar movimiento" : "Nuevo movimiento"}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "#1C1C2E", border: "none", color: "#888", width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 17, fontWeight: 700 }}>×</button>
            </div>

            {/* tipo */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[["expense", "Gasto", "#F6465D"], ["income", "Ingreso", "#0ECB81"]].map(([t, l, c]) => (
                <button
                  key={t}
                  onClick={() => setForm((f) => ({ ...f, type: t, category: t === "expense" ? "super" : "nomina" }))}
                  style={{ padding: "11px", borderRadius: 10, border: `1px solid ${form.type === t ? c : "#2A2A45"}`, background: form.type === t ? c + "22" : "#1C1C2E", color: form.type === t ? c : "#555", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* importe */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>Importe</div>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: 20, fontWeight: 700 }}>€</span>
                <input
                  type="number" step="0.01" min="0"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  style={{ ...S.input, paddingLeft: 32, fontSize: 24, fontWeight: 800 }}
                  autoFocus
                />
              </div>
            </div>

            {/* categoría */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>Categoría</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {CATS[form.type].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setForm((f) => ({ ...f, category: cat.id }))}
                    style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${form.category === cat.id ? cat.color : "#2A2A45"}`, background: form.category === cat.id ? cat.color + "22" : "#1C1C2E", color: form.category === cat.id ? cat.color : "#666", fontSize: 12, cursor: "pointer", fontWeight: form.category === cat.id ? 700 : 400 }}
                  >
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* descripción */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>Descripción</div>
              <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Mercadona, nómina enero…" style={S.input} />
            </div>

            {/* fecha */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>Fecha</div>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={S.input} />
            </div>

            {/* nota */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>Nota (opcional)</div>
              <input type="text" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Cualquier detalle adicional…" style={S.input} />
            </div>

            {/* etiquetas */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>Etiquetas (separadas por coma)</div>
              <input type="text" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="familia, trabajo, urgente…" style={S.input} />
            </div>

            {/* recurrente */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, padding: "10px 14px", background: "#1C1C2E", borderRadius: 10 }}>
              <input
                type="checkbox" id="recurring"
                checked={form.recurring}
                onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: "#7B61FF" }}
              />
              <label htmlFor="recurring" style={{ fontSize: 13, color: "#aaa", cursor: "pointer" }}>↺ Gasto recurrente mensual</label>
            </div>

            <button
              onClick={submitForm}
              disabled={!form.amount || parseFloat(form.amount) <= 0}
              style={{ ...S.btn(form.type === "income" ? "#0ECB81" : "#7B61FF"), opacity: (!form.amount || parseFloat(form.amount) <= 0) ? 0.4 : 1, fontSize: 15 }}
            >
              {editId ? "Guardar cambios" : "Añadir movimiento"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
