#![allow(clippy::unused_async)]
//! Admin HTML (CRUD) da apuração — telas server-side com Tera.
//! Cadastro de candidatos e urnas. Sem auth por enquanto (Fase 1).
use loco_rs::prelude::*;
use sea_orm::QueryOrder;
use serde::Deserialize;

use crate::crypto;
use crate::models::_entities::{candidatos, urnas};

/// Monta o objeto `candidates.json` no schema acordado com a urna
/// (`number, name, party, photo, name_vice, photo_vice`).
fn build_candidates_json(items: &[candidatos::Model]) -> serde_json::Value {
    let cands: Vec<serde_json::Value> = items
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
    serde_json::json!({ "candidates": cands })
}

/// Converte string vazia (campo de formulário em branco) em `None`.
fn blank_to_none(s: String) -> Option<String> {
    let s = s.trim();
    if s.is_empty() {
        None
    } else {
        Some(s.to_string())
    }
}

// ------------------------------------------------------------------ dashboard

#[debug_handler]
async fn dashboard(
    ViewEngine(v): ViewEngine<TeraView>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let total_candidatos = candidatos::Entity::find().all(&ctx.db).await?.len();
    let total_urnas = urnas::Entity::find().all(&ctx.db).await?.len();
    format::view(
        &v,
        "admin/dashboard.html",
        data!({
            "total_candidatos": total_candidatos,
            "total_urnas": total_urnas,
        }),
    )
}

// ----------------------------------------------------------------- candidatos

#[derive(Debug, Deserialize)]
struct CandidatoForm {
    numero: String,
    nome: String,
    partido: String,
    foto_svg: String,
    nome_vice: String,
    foto_vice_svg: String,
}

#[debug_handler]
async fn candidatos_list(
    ViewEngine(v): ViewEngine<TeraView>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let items = candidatos::Entity::find()
        .order_by_asc(candidatos::Column::Numero)
        .all(&ctx.db)
        .await?;
    format::view(
        &v,
        "admin/candidatos/list.html",
        data!({ "candidatos": items }),
    )
}

#[debug_handler]
async fn candidatos_new(ViewEngine(v): ViewEngine<TeraView>) -> Result<Response> {
    format::view(
        &v,
        "admin/candidatos/form.html",
        data!({
            "title": "Novo candidato",
            "action": "/admin/candidatos",
            "c": {
                "numero": "", "nome": "", "partido": "",
                "foto_svg": "", "nome_vice": "", "foto_vice_svg": ""
            },
        }),
    )
}

#[debug_handler]
async fn candidatos_create(
    ViewEngine(v): ViewEngine<TeraView>,
    State(ctx): State<AppContext>,
    Form(form): Form<CandidatoForm>,
) -> Result<Response> {
    let item = candidatos::ActiveModel {
        numero: Set(form.numero.trim().to_string()),
        nome: Set(form.nome.clone()),
        partido: Set(form.partido.clone()),
        foto_svg: Set(blank_to_none(form.foto_svg.clone())),
        nome_vice: Set(form.nome_vice.clone()),
        foto_vice_svg: Set(blank_to_none(form.foto_vice_svg.clone())),
        ..Default::default()
    };

    match item.insert(&ctx.db).await {
        Ok(_) => format::redirect("/admin/candidatos"),
        Err(e) => format::view(
            &v,
            "admin/candidatos/form.html",
            data!({
                "title": "Novo candidato",
                "action": "/admin/candidatos",
                "error": format!("Não foi possível salvar (o número já existe?). Detalhe: {e}"),
                "c": {
                    "numero": form.numero, "nome": form.nome, "partido": form.partido,
                    "foto_svg": form.foto_svg, "nome_vice": form.nome_vice,
                    "foto_vice_svg": form.foto_vice_svg
                },
            }),
        ),
    }
}

#[debug_handler]
async fn candidatos_edit(
    ViewEngine(v): ViewEngine<TeraView>,
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
) -> Result<Response> {
    let Some(model) = candidatos::Entity::find_by_id(id).one(&ctx.db).await? else {
        return not_found();
    };
    format::view(
        &v,
        "admin/candidatos/form.html",
        data!({
            "title": "Editar candidato",
            "action": format!("/admin/candidatos/{id}"),
            "c": model,
        }),
    )
}

#[debug_handler]
async fn candidatos_update(
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
    Form(form): Form<CandidatoForm>,
) -> Result<Response> {
    let Some(model) = candidatos::Entity::find_by_id(id).one(&ctx.db).await? else {
        return not_found();
    };
    let mut item = model.into_active_model();
    item.numero = Set(form.numero.trim().to_string());
    item.nome = Set(form.nome);
    item.partido = Set(form.partido);
    item.foto_svg = Set(blank_to_none(form.foto_svg));
    item.nome_vice = Set(form.nome_vice);
    item.foto_vice_svg = Set(blank_to_none(form.foto_vice_svg));
    item.update(&ctx.db).await?;
    format::redirect("/admin/candidatos")
}

#[debug_handler]
async fn candidatos_delete(State(ctx): State<AppContext>, Path(id): Path<i64>) -> Result<Response> {
    if let Some(model) = candidatos::Entity::find_by_id(id).one(&ctx.db).await? {
        model.into_active_model().delete(&ctx.db).await?;
    }
    format::redirect("/admin/candidatos")
}

// ---------------------------------------------------------------------- urnas

#[derive(Debug, Deserialize)]
struct UrnaForm {
    nome: String,
    chave_publica: String,
}

#[debug_handler]
async fn urnas_list(
    ViewEngine(v): ViewEngine<TeraView>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    let items = urnas::Entity::find()
        .order_by_asc(urnas::Column::Nome)
        .all(&ctx.db)
        .await?;
    format::view(&v, "admin/urnas/list.html", data!({ "urnas": items }))
}

#[debug_handler]
async fn urnas_new(ViewEngine(v): ViewEngine<TeraView>) -> Result<Response> {
    format::view(
        &v,
        "admin/urnas/form.html",
        data!({
            "title": "Nova urna",
            "action": "/admin/urnas",
            "u": { "nome": "", "chave_publica": "" },
        }),
    )
}

#[debug_handler]
async fn urnas_create(
    ViewEngine(v): ViewEngine<TeraView>,
    State(ctx): State<AppContext>,
    Form(form): Form<UrnaForm>,
) -> Result<Response> {
    let item = urnas::ActiveModel {
        nome: Set(form.nome.clone()),
        chave_publica: Set(form.chave_publica.trim().to_string()),
        ..Default::default()
    };
    match item.insert(&ctx.db).await {
        Ok(_) => format::redirect("/admin/urnas"),
        Err(e) => format::view(
            &v,
            "admin/urnas/form.html",
            data!({
                "title": "Nova urna",
                "action": "/admin/urnas",
                "error": format!("Não foi possível salvar (chave pública já existe?). Detalhe: {e}"),
                "u": { "nome": form.nome, "chave_publica": form.chave_publica },
            }),
        ),
    }
}

#[debug_handler]
async fn urnas_edit(
    ViewEngine(v): ViewEngine<TeraView>,
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
) -> Result<Response> {
    let Some(model) = urnas::Entity::find_by_id(id).one(&ctx.db).await? else {
        return not_found();
    };
    format::view(
        &v,
        "admin/urnas/form.html",
        data!({
            "title": "Editar urna",
            "action": format!("/admin/urnas/{id}"),
            "u": model,
        }),
    )
}

#[debug_handler]
async fn urnas_update(
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
    Form(form): Form<UrnaForm>,
) -> Result<Response> {
    let Some(model) = urnas::Entity::find_by_id(id).one(&ctx.db).await? else {
        return not_found();
    };
    let mut item = model.into_active_model();
    item.nome = Set(form.nome);
    item.chave_publica = Set(form.chave_publica.trim().to_string());
    item.update(&ctx.db).await?;
    format::redirect("/admin/urnas")
}

#[debug_handler]
async fn urnas_delete(State(ctx): State<AppContext>, Path(id): Path<i64>) -> Result<Response> {
    if let Some(model) = urnas::Entity::find_by_id(id).one(&ctx.db).await? {
        model.into_active_model().delete(&ctx.db).await?;
    }
    format::redirect("/admin/urnas")
}

// ------------------------------------------------------------ exportar carga

#[debug_handler]
async fn urnas_carga(
    ViewEngine(v): ViewEngine<TeraView>,
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
) -> Result<Response> {
    let Some(urna) = urnas::Entity::find_by_id(id).one(&ctx.db).await? else {
        return not_found();
    };
    let items = candidatos::Entity::find()
        .order_by_asc(candidatos::Column::Numero)
        .all(&ctx.db)
        .await?;
    let canonical = crypto::stable_stringify(&build_candidates_json(&items));
    let hash = crypto::sha256_hex(canonical.as_bytes());
    format::view(
        &v,
        "admin/urnas/carga.html",
        data!({ "urna": urna, "total": items.len(), "hash": hash }),
    )
}

#[debug_handler]
async fn urnas_carga_download(
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
) -> Result<Response> {
    let Some(urna) = urnas::Entity::find_by_id(id).one(&ctx.db).await? else {
        return not_found();
    };
    let items = candidatos::Entity::find()
        .order_by_asc(candidatos::Column::Numero)
        .all(&ctx.db)
        .await?;
    let canonical = crypto::stable_stringify(&build_candidates_json(&items));
    let hash = crypto::sha256_hex(canonical.as_bytes());
    let encrypted = crypto::encrypt_with_code(&urna.chave_publica, &canonical)
        .map_err(|e| Error::string(&e))?;

    // Importante: a chave de 6 dígitos NÃO vai no arquivo (nem no nome dele) — ela é a
    // própria chave de descriptografia; expô-la aqui anularia a criptografia.
    let body = serde_json::to_string_pretty(&serde_json::json!({
        "urna": urna.nome,
        "encrypted": encrypted,
        "hash": hash,
    }))
    .map_err(|e| Error::string(&e.to_string()))?;

    let filename = format!("candidates-urna-{}.enc.json", urna.id);
    Ok((
        [
            (
                axum::http::header::CONTENT_TYPE,
                "application/json; charset=utf-8".to_string(),
            ),
            (
                axum::http::header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{filename}\""),
            ),
        ],
        body,
    )
        .into_response())
}

#[debug_handler]
async fn urnas_carga_preview(
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
) -> Result<Response> {
    let Some(_urna) = urnas::Entity::find_by_id(id).one(&ctx.db).await? else {
        return not_found();
    };
    let items = candidatos::Entity::find()
        .order_by_asc(candidatos::Column::Numero)
        .all(&ctx.db)
        .await?;
    let obj = build_candidates_json(&items);
    let hash = crypto::sha256_hex(crypto::stable_stringify(&obj).as_bytes());

    // Texto puro (sem criptografia), só para validação/inspeção: expõe o mesmo
    // objeto que é criptografado mais o hash canônico, para conferir a olho.
    let body = serde_json::to_string_pretty(&serde_json::json!({
        "hash": hash,
        "candidates": obj["candidates"],
    }))
    .map_err(|e| Error::string(&e.to_string()))?;

    Ok((
        [(
            axum::http::header::CONTENT_TYPE,
            "application/json; charset=utf-8".to_string(),
        )],
        body,
    )
        .into_response())
}

// ----------------------------------------------------- receber poll_report

use crate::models::_entities::poll_reports;

/// Extrai o base64 criptografado (e o hash, se houver) do conteúdo do arquivo
/// enviado. Aceita tanto o envelope `{ "encrypted": ..., "hash": ... }` quanto
/// o próprio base64 cru.
fn extrair_encrypted(texto: &str) -> Result<(String, Option<String>), String> {
    let t = texto.trim();
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(t) {
        if let Some(enc) = v.get("encrypted").and_then(serde_json::Value::as_str) {
            let hash = v
                .get("hash")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string);
            return Ok((enc.to_string(), hash));
        }
        return Err("arquivo JSON sem o campo 'encrypted'".to_string());
    }
    // não é JSON: tratar o conteúdo como o base64 cru
    Ok((t.to_string(), None))
}

async fn render_boletim_page(
    v: &TeraView,
    ctx: &AppContext,
    urna: &urnas::Model,
    error: Option<String>,
) -> Result<Response> {
    let recebidos = poll_reports::Entity::find()
        .filter(poll_reports::Column::UrnaId.eq(urna.id))
        .order_by_desc(poll_reports::Column::Id)
        .all(&ctx.db)
        .await?;
    format::view(
        v,
        "admin/urnas/boletim.html",
        data!({ "urna": urna, "recebidos": recebidos, "error": error }),
    )
}

#[debug_handler]
async fn urnas_boletim(
    ViewEngine(v): ViewEngine<TeraView>,
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
) -> Result<Response> {
    let Some(urna) = urnas::Entity::find_by_id(id).one(&ctx.db).await? else {
        return not_found();
    };
    render_boletim_page(&v, &ctx, &urna, None).await
}

#[debug_handler]
async fn urnas_boletim_preview(
    ViewEngine(v): ViewEngine<TeraView>,
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
    mut multipart: Multipart,
) -> Result<Response> {
    let Some(urna) = urnas::Entity::find_by_id(id).one(&ctx.db).await? else {
        return not_found();
    };

    // lê o arquivo enviado (campo "arquivo")
    let mut conteudo = String::new();
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| Error::string(&e.to_string()))?
    {
        if field.name() == Some("arquivo") {
            let bytes = field.bytes().await.map_err(|e| Error::string(&e.to_string()))?;
            conteudo = String::from_utf8_lossy(&bytes).to_string();
        }
    }
    if conteudo.trim().is_empty() {
        return render_boletim_page(&v, &ctx, &urna, Some("Selecione um arquivo.".to_string())).await;
    }

    let (encrypted, hash_arquivo) = match extrair_encrypted(&conteudo) {
        Ok(x) => x,
        Err(e) => return render_boletim_page(&v, &ctx, &urna, Some(e)).await,
    };

    // descriptografa com a chave (6 dígitos) que cadastramos para esta urna
    let plaintext = match crypto::decrypt_with_code(&urna.chave_publica, &encrypted) {
        Ok(p) => p,
        Err(e) => return render_boletim_page(&v, &ctx, &urna, Some(e)).await,
    };
    let Ok(report) = serde_json::from_str::<serde_json::Value>(&plaintext) else {
        return render_boletim_page(
            &v,
            &ctx,
            &urna,
            Some("O conteúdo decifrado não é um JSON válido.".to_string()),
        )
        .await;
    };

    let hash_calculado = crypto::sha256_hex(crypto::stable_stringify(&report).as_bytes());
    let hash_confere = hash_arquivo.as_ref().map(|h| h == &hash_calculado);

    // dados para exibição
    let terminal_id = report.get("terminal_id").and_then(serde_json::Value::as_str);
    let total = report.get("total").and_then(serde_json::Value::as_i64);
    let tally: Vec<serde_json::Value> = report
        .get("tally")
        .and_then(serde_json::Value::as_object)
        .map(|m| {
            m.iter()
                .map(|(numero, votos)| serde_json::json!({ "numero": numero, "votos": votos }))
                .collect()
        })
        .unwrap_or_default();

    format::view(
        &v,
        "admin/urnas/boletim_preview.html",
        data!({
            "urna": urna,
            "encrypted": encrypted,
            "terminal_id": terminal_id,
            "total": total,
            "tally": tally,
            "hash_calculado": hash_calculado,
            "hash_arquivo": hash_arquivo,
            "hash_confere": hash_confere,
        }),
    )
}

#[derive(Debug, Deserialize)]
struct BoletimAceitarForm {
    encrypted: String,
}

#[debug_handler]
async fn urnas_boletim_aceitar(
    ViewEngine(v): ViewEngine<TeraView>,
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
    Form(form): Form<BoletimAceitarForm>,
) -> Result<Response> {
    let Some(urna) = urnas::Entity::find_by_id(id).one(&ctx.db).await? else {
        return not_found();
    };

    // redecifra no servidor (não confiamos em dados já decifrados vindos do cliente)
    let plaintext = match crypto::decrypt_with_code(&urna.chave_publica, &form.encrypted) {
        Ok(p) => p,
        Err(e) => return render_boletim_page(&v, &ctx, &urna, Some(e)).await,
    };
    let Ok(report) = serde_json::from_str::<serde_json::Value>(&plaintext) else {
        return render_boletim_page(
            &v,
            &ctx,
            &urna,
            Some("O conteúdo decifrado não é um JSON válido.".to_string()),
        )
        .await;
    };

    let hash = crypto::sha256_hex(crypto::stable_stringify(&report).as_bytes());
    let terminal_id = report
        .get("terminal_id")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let total = report
        .get("total")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(0);
    let tally_json = report
        .get("tally")
        .map(std::string::ToString::to_string)
        .unwrap_or_else(|| "{}".to_string());
    let issued_at = report
        .get("issued_at")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);

    let item = poll_reports::ActiveModel {
        urna_id: Set(urna.id),
        terminal_id: Set(terminal_id),
        total: Set(total),
        tally_json: Set(tally_json),
        hash: Set(hash),
        issued_at: Set(issued_at),
        ..Default::default()
    };
    item.insert(&ctx.db).await?;

    format::redirect(&format!("/admin/urnas/{id}/boletim"))
}

// --------------------------------------------------------------------- routes

pub fn routes() -> Routes {
    Routes::new()
        .prefix("/admin")
        .add("/", get(dashboard))
        // candidatos
        .add("/candidatos", get(candidatos_list))
        .add("/candidatos/novo", get(candidatos_new))
        .add("/candidatos", post(candidatos_create))
        .add("/candidatos/{id}/editar", get(candidatos_edit))
        .add("/candidatos/{id}", post(candidatos_update))
        .add("/candidatos/{id}/excluir", post(candidatos_delete))
        // urnas
        .add("/urnas", get(urnas_list))
        .add("/urnas/nova", get(urnas_new))
        .add("/urnas", post(urnas_create))
        .add("/urnas/{id}/editar", get(urnas_edit))
        .add("/urnas/{id}", post(urnas_update))
        .add("/urnas/{id}/excluir", post(urnas_delete))
        .add("/urnas/{id}/carga", get(urnas_carga))
        .add("/urnas/{id}/carga/download", get(urnas_carga_download))
        .add("/urnas/{id}/carga/preview", get(urnas_carga_preview))
        .add("/urnas/{id}/boletim", get(urnas_boletim))
        .add("/urnas/{id}/boletim/preview", post(urnas_boletim_preview))
        .add("/urnas/{id}/boletim/aceitar", post(urnas_boletim_aceitar))
}
