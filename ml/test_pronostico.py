import numpy as np
import pandas as pd
from pronostico import MIN_HISTORIAL, pronosticar


def serie(n, ruido=0.0, seed=0):
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2026-01-01", periods=n)
    base = np.array([2, 8, 8, 9, 10, 14, 6])[idx.dayofweek] + 10  # patrón semanal
    return pd.Series(base + rng.normal(0, ruido, n), index=idx)


def test_patron_semanal_se_publica():
    out = pronosticar(serie(200, 0.5))
    assert out is not None
    df, mape = out
    assert mape < 20 and len(df) == 28
    assert (df["min"] <= df["estimado"]).all() and (df["estimado"] <= df["max"]).all()


def test_poco_historial_no_se_publica():
    assert pronosticar(serie(MIN_HISTORIAL - 1)) is None


def test_ruido_alto_no_se_publica():
    assert pronosticar(serie(200, 40, seed=1)) is None
