"""
Scouting App — Player Identification & Comparison Tool (Streamlit)
=====================================================================
App interactiva agnóstica a la fuente de datos: funciona con el CSV
que genera scouting_engine.py (StatsBomb) o con un CSV armado a mano
desde FBref (ej. Liga Profesional Argentina, que StatsBomb Open Data
no cubre para temporadas recientes).

Requisitos:
    pip install streamlit pandas numpy matplotlib mplsoccer scikit-learn

Uso:
    streamlit run scouting_app.py
"""

import io
import numpy as np
import pandas as pd
import streamlit as st
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity

st.set_page_config(page_title="Scouting Engine", layout="wide", page_icon="⚽")

# --------------------------------------------------------------------------
# ESTILO
# --------------------------------------------------------------------------
st.markdown("""
<style>
    .stApp { background-color: #0d1117; }
    h1, h2, h3, p, label, .stMarkdown { color: #e6e6e6 !important; }
    div[data-testid="stMetricValue"] { color: #2ecc71; }
    .stDataFrame { background-color: #161b22; }
</style>
""", unsafe_allow_html=True)

st.title("⚽ Scouting Engine")
st.caption("Identificación y comparación de jugadores por percentiles y similitud de perfil")

# --------------------------------------------------------------------------
# CARGA DE DATOS
# --------------------------------------------------------------------------
st.sidebar.header("1. Datos")
source = st.sidebar.radio(
    "Fuente de datos",
    ["Usar Liga Profesional Argentina 2026 (incluido)", "Subir CSV propio"],
)

REQUIRED_COLS = ["player", "position", "minutes_played"]

@st.cache_data
def load_example():
    return pd.read_csv("fbref_liga_profesional_master.csv", sep=";", decimal=",")

df = None
if source.startswith("Usar"):
    df = load_example()
elif source.startswith("Subir"):
    st.sidebar.markdown(
        "**Formato esperado:** columnas `player`, `position`, `minutes_played` "
        "+ cualquier cantidad de métricas numéricas (idealmente ya en per-90, "
        "pero podés normalizar acá abajo).\n\n"
        "Separador `;` y coma decimal (formato Excel ES) o `,`/`.` estándar — ambos funcionan."
    )
    uploaded = st.sidebar.file_uploader("Subí tu CSV", type=["csv"])
    if uploaded:
        raw = uploaded.read()
        # detectar separador/decimal automáticamente
        try:
            df = pd.read_csv(io.BytesIO(raw), sep=";", decimal=",")
            if df.shape[1] == 1:
                raise ValueError
        except Exception:
            df = pd.read_csv(io.BytesIO(raw), sep=",", decimal=".")

if df is None:
    st.info("Subí un CSV o elegí el dataset de ejemplo para empezar.")
    st.stop()

missing = [c for c in REQUIRED_COLS if c not in df.columns]
if missing:
    st.error(f"Faltan columnas obligatorias: {missing}. Columnas encontradas: {list(df.columns)}")
    st.stop()

df["position"] = df["position"].fillna("Sin dato").astype(str)

# --------------------------------------------------------------------------
# CONFIGURACIÓN DE MÉTRICAS Y POSICIONES
# --------------------------------------------------------------------------
st.sidebar.header("2. Configuración")

numeric_cols = [c for c in df.select_dtypes(include=[np.number]).columns
                 if c not in ["minutes_played"]]

default_metrics = [c for c in numeric_cols if c.endswith("_p90") or c.endswith("_pct")][:11]
if not default_metrics:
    default_metrics = numeric_cols[:8]

metrics = st.sidebar.multiselect(
    "Métricas para radar y similitud",
    options=numeric_cols,
    default=default_metrics,
)

min_minutes = st.sidebar.slider("Minutos jugados mínimos", 0, int(df["minutes_played"].max()), 270, step=90)

def infer_position_group(pos: str) -> str:
    """Detecta el grupo posicional a partir del código FBref (ej. FWMF, DFMF, GK)."""
    p = str(pos).upper()
    if "GK" in p:
        return "GK"
    if p.startswith("FW") or p.endswith("FW"):
        return "FWD"
    if p.startswith("DF") or p.endswith("DF"):
        return "DEF"
    if "MF" in p:
        return "MID"
    return "MID"

if "position_group" not in df.columns:
    positions = sorted(df["position"].dropna().astype(str).unique())
    st.sidebar.markdown("**Grupo posicional** (detectado automático desde el código FBref — corregí si hace falta)")
    pos_group_input = {}
    with st.sidebar.expander("Revisar mapeo de posiciones"):
        for p in positions:
            default_group = infer_position_group(p)
            default_idx = ["DEF", "MID", "FWD", "GK"].index(default_group)
            pos_group_input[p] = st.selectbox(p, ["DEF", "MID", "FWD", "GK"], index=default_idx, key=f"grp_{p}")
    df["position_group"] = df["position"].map(pos_group_input)

df_f = df[df["minutes_played"] >= min_minutes].copy()

if not metrics:
    st.warning("Elegí al menos una métrica en la barra lateral.")
    st.stop()

# --------------------------------------------------------------------------
# PERCENTILES
# --------------------------------------------------------------------------
for m in metrics:
    df_f[m] = df_f[m].fillna(0)
    df_f[f"{m}_pct"] = df_f.groupby("position_group")[m].rank(pct=True) * 100

# --------------------------------------------------------------------------
# UI PRINCIPAL
# --------------------------------------------------------------------------
tab1, tab2, tab3 = st.tabs(["📊 Radar de jugador", "🔍 Jugadores similares", "📋 Tabla completa"])

with tab1:
    col1, col2 = st.columns([1, 2])
    with col1:
        pos_filter = st.selectbox("Posición", ["Todas"] + sorted(df_f["position_group"].unique()), key="pos_filter_radar")
        pool = df_f if pos_filter == "Todas" else df_f[df_f["position_group"] == pos_filter]
        player = st.selectbox("Jugador", sorted(pool["player"].unique()))
        row = df_f[df_f["player"] == player].iloc[0]
        st.metric("Grupo posicional", row["position_group"])
        st.metric("Minutos jugados", int(row["minutes_played"]))
        for m in metrics[:4]:
            st.metric(m.replace("_p90", "").replace("_", " ").title(), f"{row[m]:.2f}", f"Percentil {row[f'{m}_pct']:.0f}")

    with col2:
        from mplsoccer import PyPizza
        values = [round(row[f"{m}_pct"]) if pd.notna(row[f"{m}_pct"]) else 0 for m in metrics]
        labels = [m.replace("_p90", "").replace("_pct", "").replace("_", " ").title() for m in metrics]
        colors = ["#2ecc71" if v >= 70 else ("#f1c40f" if v >= 40 else "#e74c3c") for v in values]

        baker = PyPizza(
            params=labels, background_color="#0d1117", straight_line_color="#2a2f3a",
            straight_line_lw=1, last_circle_lw=1, other_circle_lw=1, inner_circle_size=8,
        )
        fig, ax = baker.make_pizza(
            values, figsize=(8, 8.5), color_blank_space="same",
            slice_colors=colors, value_colors=["#ffffff"] * len(values), value_bck_colors=["#000000"] * len(values),
            kwargs_slices=dict(edgecolor="#0d1117", linewidth=2),
            kwargs_params=dict(color="#e6e6e6", fontsize=10),
            kwargs_values=dict(fontsize=13, fontweight="bold"),
        )
        fig.text(0.5, 0.97, player, ha="center", color="#fff", fontsize=16, fontweight="bold")
        fig.text(0.5, 0.945, f"Percentil vs. {row['position_group']}", ha="center", color="#9aa4b2", fontsize=10)
        st.pyplot(fig, use_container_width=True)

with tab2:
    col1, col2 = st.columns([1, 1])
    with col1:
        pos_filter_sim = st.selectbox("Posición", ["Todas"] + sorted(df_f["position_group"].unique()), key="pos_filter_sim")
        pool_sim = df_f if pos_filter_sim == "Todas" else df_f[df_f["position_group"] == pos_filter_sim]
        player_sim = st.selectbox("Buscar similares a:", sorted(pool_sim["player"].unique()), key="sim_player")
        top_n = st.slider("Cantidad de resultados", 3, 15, 5)

    group = df_f.loc[df_f["player"] == player_sim, "position_group"].iloc[0]
    pool = df_f[df_f["position_group"] == group].reset_index(drop=True)
    X = StandardScaler().fit_transform(pool[metrics].fillna(0))
    sim_matrix = cosine_similarity(X)
    idx = pool[pool["player"] == player_sim].index[0]
    sims = pd.Series(sim_matrix[idx], index=pool["player"]).drop(player_sim)
    top = sims.sort_values(ascending=False).head(top_n).reset_index()
    top.columns = ["Jugador", "Similitud"]
    top["Similitud"] = (top["Similitud"] * 100).round(1).astype(str) + "%"

    with col2:
        st.subheader(f"Perfiles más parecidos a {player_sim}")
        st.dataframe(top, use_container_width=True, hide_index=True)

with tab3:
    st.subheader("Dataset filtrado")
    show_cols = ["player", "position", "position_group", "minutes_played"] + metrics
    st.dataframe(df_f[show_cols].sort_values(metrics[0], ascending=False), use_container_width=True, hide_index=True)
    st.download_button(
        "Descargar tabla filtrada (CSV, formato Excel ES)",
        df_f[show_cols].to_csv(sep=";", decimal=",", index=False).encode("utf-8"),
        "scouting_filtrado.csv", "text/csv",
    )
