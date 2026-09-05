#![allow(clippy::unused_async)]
//! API pública consumida pelo front de apuração (a tela que mostra a contagem).
//!
//! Formato alinhado ao que o front espera (ver `apuracao/frontend/src/api.js`):
//! `GET /apuracao/candidates` devolve um **array** de candidatos com
//! `number, name, party, photo` (+ `name_vice`, `photo_vice`). `photo` é SVG
//! inline; quando vazio, o front aplica uma silhueta padrão.
//!
//! `GET /apuracao/resultados?page=N` consolida os boletins recebidos e devolve
//! o resultado fatiado em 10 páginas, cada uma no formato de um `poll_report`.
use std::collections::BTreeMap;

use loco_rs::prelude::*;
use sea_orm::QueryOrder;
use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::models::_entities::{candidatos, poll_reports};

/// Quantidade fixa de páginas em que o resultado é dividido para a animação.
const TOTAL_PAGINAS: i64 = 10;

#[debug_handler]
async fn candidates(State(ctx): State<AppContext>) -> Result<Response> {
    let items = candidatos::Entity::find()
        .order_by_asc(candidatos::Column::Numero)
        .all(&ctx.db)
        .await?;

    let list: Vec<serde_json::Value> = items
        .iter()
        .map(|c| {
            serde_json::json!({
                "number": c.numero,
                "name": c.nome,
                "party": c.partido,
                "photo": c.foto_svg.clone().unwrap_or_default(),
                "name_vice": c.nome_vice,
                "photo_vice": c.foto_vice_svg.clone().unwrap_or_default(),
            })
        })
        .collect();

    Ok(Json(list).into_response())
}

/// Parâmetros de query de `GET /apuracao/resultados`.
#[derive(Debug, Deserialize)]
struct ParamsPagina {
    page: Option<i64>,
}

/// Gera os 10 pesos determinísticos de um número, um por página.
///
/// Cada peso vem dos dois primeiros bytes de `SHA-256("{numero}:{pagina}")`.
/// O `+ 1` garante que nenhum peso seja zero (senão a página nunca receberia
/// votos e a soma de pesos poderia zerar).
fn pesos_do_numero(numero: &str) -> Vec<u64> {
    (0..TOTAL_PAGINAS)
        .map(|p| {
            let digest = Sha256::digest(format!("{numero}:{p}").as_bytes());
            u64::from(u16::from_be_bytes([digest[0], digest[1]])) + 1
        })
        .collect()
}

/// Distribui `votos` entre as páginas proporcionalmente aos pesos, de forma que
/// a soma das partes seja exatamente `votos`.
///
/// A divisão inteira sempre deixa uma sobra; ela é entregue de uma em uma às
/// páginas de maior peso até zerar, mantendo a fatia estável entre requests.
fn distribuir(votos: i64, pesos: &[u64]) -> Vec<i64> {
    let soma_pesos: u64 = pesos.iter().sum();
    let votos_u = u64::try_from(votos.max(0)).unwrap_or(0);

    let mut partes: Vec<i64> = pesos
        .iter()
        .map(|&peso| {
            let parte = votos_u.saturating_mul(peso) / soma_pesos;
            i64::try_from(parte).unwrap_or(0)
        })
        .collect();

    let distribuido: i64 = partes.iter().sum();
    let mut resto = votos - distribuido;

    // Páginas ordenadas do maior peso para o menor: a sobra vai para elas.
    let mut ordem: Vec<usize> = (0..partes.len()).collect();
    ordem.sort_by(|&a, &b| pesos[b].cmp(&pesos[a]));

    let mut i = 0;
    while resto > 0 && !ordem.is_empty() {
        partes[ordem[i % ordem.len()]] += 1;
        resto -= 1;
        i += 1;
    }

    partes
}

#[debug_handler]
async fn resultados(
    State(ctx): State<AppContext>,
    Query(q): Query<ParamsPagina>,
) -> Result<Response> {
    // Página pedida, com clamp em 1..=TOTAL_PAGINAS.
    let page = q.page.unwrap_or(1).clamp(1, TOTAL_PAGINAS);

    // Consolida todos os boletins recebidos: soma os votos de cada número.
    let boletins = poll_reports::Entity::find().all(&ctx.db).await?;

    let mut consolidado: BTreeMap<String, i64> = BTreeMap::new();
    for boletim in &boletins {
        let Ok(serde_json::Value::Object(mapa)) =
            serde_json::from_str::<serde_json::Value>(&boletim.tally_json)
        else {
            continue;
        };
        for (numero, votos) in mapa {
            if let Some(v) = votos.as_i64() {
                *consolidado.entry(numero).or_insert(0) += v;
            }
        }
    }

    let total: i64 = consolidado.values().sum();

    // Fatia da página pedida: para cada número, a parte que cai nesta página.
    let mut tally = serde_json::Map::new();
    for (numero, votos) in &consolidado {
        let pesos = pesos_do_numero(numero);
        let partes = distribuir(*votos, &pesos);
        let parte = partes[usize::try_from(page - 1).unwrap_or(0)];
        tally.insert(numero.clone(), serde_json::json!(parte));
    }

    let valor = serde_json::json!({
        "type": "poll_report",
        "issued_at": chrono::Utc::now().to_rfc3339(),
        "tally": tally,
        "total": total,
        "page": page,
        "total_pages": TOTAL_PAGINAS,
    });

    Ok(Json(valor).into_response())
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("/apuracao")
        .add("/candidates", get(candidates))
        .add("/resultados", get(resultados))
}
