# ===========================================================================
# PROJETO: Frontend de Monitoramento IoT (somente visualizacao)
# VERSAO: 3.0
# AUTOR: Bruna Coelho
# OBJETIVO:
# Exibir os dados da API. NAO acessa o banco e NAO tem regra de negocio:
# autenticacao, autorizacao e validacao ficam todas no backend.
# ===========================================================================

import os
from datetime import date

import pandas as pd
import plotly.express as px
import requests
import streamlit as st

API_URL = os.getenv("API_URL", "http://127.0.0.1:3000/api").rstrip("/")
TEMPO_LIMITE = 10  # segundos

st.set_page_config(page_title="IoT Temperature Dashboard", layout="wide")


class SessaoExpirada(Exception):
    """O backend recusou o token (expirou ou e invalido)."""


def fazer_login(email, senha):
    """Pede o token ao backend. Devolve uma mensagem de erro ou None."""
    try:
        resposta = requests.post(
            f"{API_URL}/auth/login", json={"email": email, "senha": senha}, timeout=TEMPO_LIMITE
        )
    except requests.RequestException:
        return "Nao foi possivel conectar ao servidor."
    if resposta.status_code == 429:
        return "Muitas tentativas. Aguarde um minuto."
    if resposta.status_code != 200:
        return "Email ou senha invalidos."
    dados = resposta.json()
    st.session_state["token"] = dados["token"]
    st.session_state["usuario"] = dados["usuario"]
    return None


def sair():
    st.session_state.clear()


def tela_login():
    st.title("🌡️ Monitoramento de Sensores IoT")
    with st.form("login"):
        email = st.text_input("Email")
        senha = st.text_input("Senha", type="password")
        if st.form_submit_button("Entrar"):
            erro = fazer_login(email, senha)
            if erro:
                st.error(erro)
            else:
                st.rerun()


@st.cache_data(ttl=120, show_spinner=False)
def buscar(caminho, token, params_tuple):
    """Cache por token+filtros, assim usuarios diferentes nunca compartilham dados."""
    resposta = requests.get(
        f"{API_URL}{caminho}",
        params=dict(params_tuple),
        headers={"Authorization": f"Bearer {token}"},
        timeout=TEMPO_LIMITE,
    )
    if resposta.status_code == 401:
        raise SessaoExpirada()
    resposta.raise_for_status()
    return resposta.json()


def consultar(caminho, params=None):
    return buscar(caminho, st.session_state["token"], tuple(sorted((params or {}).items())))


def painel():
    st.title("🌡️ Monitoramento de Sensores IoT")

    with st.sidebar:
        usuario = st.session_state["usuario"]
        st.caption(f"{usuario['email']} ({usuario['papel']})")
        st.button("Sair", on_click=sair)
        st.header("Filtros")

    periodo_api = consultar("/leituras/periodo")
    if not periodo_api["inicio"]:
        st.warning("Nenhum dado encontrado. Peça ao administrador para importar os dados.")
        return
    data_min = date.fromisoformat(periodo_api["inicio"][:10])
    data_max = date.fromisoformat(periodo_api["fim"][:10])

    with st.sidebar:
        periodo = st.date_input("Periodo", value=(data_min, data_max),
                                min_value=data_min, max_value=data_max)
        sentidos = st.multiselect("Sentido", ["Interno", "Externo"],
                                  default=["Interno", "Externo"])

    if len(periodo) != 2 or not sentidos:
        st.info("Selecione um periodo completo e ao menos um sentido.")
        return

    filtros = {"inicio": periodo[0].isoformat(), "fim": periodo[1].isoformat()}
    # Os dois sentidos marcados = sem filtro de sentido.
    if len(sentidos) == 1:
        filtros["sentido"] = sentidos[0].upper()

    totais = consultar("/leituras/totais", filtros)
    col1, col2, col3 = st.columns(3)
    col1.metric("Total de Leituras", f"{totais['totalLeituras']:,}".replace(",", "."))
    media = totais["temperaturaMedia"]
    col2.metric("Temp. Media", f"{media}°C" if media is not None else "-")
    col3.metric("Salas Monitoradas", totais["salasMonitoradas"])

    st.markdown("---")
    st.subheader("Linha do Tempo de Temperatura (media por hora)")
    serie = pd.DataFrame(consultar("/leituras/serie-horaria", filtros))
    if serie.empty:
        st.info("Sem leituras no periodo selecionado.")
    else:
        serie["sentido"] = serie["sentido"].str.capitalize()
        st.plotly_chart(
            px.line(serie, x="hora", y="temperaturaMedia", color="sentido",
                    labels={"hora": "Hora", "temperaturaMedia": "Temp. media (°C)",
                            "sentido": "Sentido"}),
            use_container_width=True,
        )

    st.subheader("Ultimas Leituras do Periodo")
    ultimas = consultar("/leituras", {**filtros, "limite": 50})["itens"]
    st.dataframe(pd.DataFrame(ultimas), use_container_width=True)


def main():
    if "token" not in st.session_state:
        tela_login()
        return
    try:
        painel()
    except SessaoExpirada:
        sair()
        st.warning("Sessao expirada. Entre novamente.")
        st.rerun()
    except requests.RequestException:
        # Sem detalhes tecnicos na tela
        st.error("Nao foi possivel carregar os dados. Tente novamente em instantes.")


main()
