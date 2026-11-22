"""HU-25: pronóstico de reservas e ingresos (offline, service role).

Uso:  python ml/pronostico.py            (todas las barberías con el módulo `pronostico`)
Env:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (nunca contra producción sin querer: revisa la URL)
Publica solo si el MAPE del backtest es < 20 % (KPI-S3); si no, borra lo anterior y la app
muestra "pronóstico aún no disponible".
"""
import os
import warnings
from datetime import date, timedelta

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

HORIZONTE = 28          # días a pronosticar
MIN_HISTORIAL = 90      # días de historial mínimo
VENTANA = 365           # historial que se usa
BACKTEST = 28           # últimos días para medir el error
MAPE_MAX = 20.0
MODELO = "holt-winters-semanal"


def _ajustar(y: pd.Series, h: int) -> np.ndarray:
    m = ExponentialSmoothing(y, trend=None, seasonal="add", seasonal_periods=7,
                             initialization_method="estimated").fit()
    return np.asarray(m.forecast(h))


def pronosticar(y: pd.Series):
    """y: serie diaria con índice de fechas continuo. Devuelve DataFrame(estimado, min, max) + mape,
    o None si no hay historial suficiente o el error supera MAPE_MAX."""
    if len(y) < MIN_HISTORIAL or y.sum() == 0:
        return None
    y = y.astype(float)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pred_bt = _ajustar(y.iloc[:-BACKTEST], BACKTEST)
        real = y.iloc[-BACKTEST:].to_numpy()
        # MAPE sobre los días con demanda (los días en 0 no tienen error porcentual)
        mask = real > 0
        if not mask.any():
            return None
        mape = float(np.mean(np.abs(real[mask] - pred_bt[mask]) / real[mask]) * 100)
        if mape >= MAPE_MAX:
            return None
        sigma = float(np.std(real - pred_bt))
        est = np.clip(_ajustar(y, HORIZONTE), 0, None)
    idx = pd.date_range(y.index[-1] + timedelta(days=1), periods=HORIZONTE)
    out = pd.DataFrame({"estimado": est,
                        "min": np.clip(est - 1.28 * sigma, 0, None),   # ~80 % de confianza
                        "max": est + 1.28 * sigma}, index=idx)
    return out, mape


def _serie(filas: list[dict], col: str, hoy: date) -> pd.Series:
    idx = pd.date_range(hoy - timedelta(days=VENTANA), hoy - timedelta(days=1))
    s = pd.Series({pd.Timestamp(f["fecha"]): float(f[col]) for f in filas}, dtype=float)
    return s.reindex(idx, fill_value=0.0)


def main():
    from supabase import create_client
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    hoy = date.today()
    barberias = db.table("barberia").select("id_barberia").eq("activa", True).execute().data
    for b in barberias:
        idb = b["id_barberia"]
        if not db.rpc("barberia_tiene_modulo", {"p_barberia": idb, "p_codigo": "pronostico"}).execute().data:
            continue
        filas = db.rpc("historial_demanda", {"p_barberia": idb, "p_desde": str(hoy - timedelta(days=VENTANA)),
                                             "p_hasta": str(hoy - timedelta(days=1))}).execute().data
        for tipo, col in (("reservas", "reservas"), ("ingresos", "ingresos")):
            # lo anterior se borra siempre: un pronóstico viejo o malo no debe quedar publicado
            db.table("prediccion_demanda").delete().eq("id_barberia", idb).eq("tipo", tipo).execute()
            r = pronosticar(_serie(filas, col, hoy))
            if r is None:
                print(f"{idb} {tipo}: no disponible")
                continue
            df, mape = r
            db.table("prediccion_demanda").insert([
                {"id_barberia": idb, "tipo": tipo, "fecha_objetivo": str(d.date()),
                 "valor_estimado": round(row.estimado, 2), "valor_min": round(row["min"], 2),
                 "valor_max": round(row["max"], 2), "modelo": MODELO, "mape": round(mape, 2)}
                for d, row in df.iterrows()]).execute()
            print(f"{idb} {tipo}: ok, MAPE {mape:.1f} %")


if __name__ == "__main__":
    main()
