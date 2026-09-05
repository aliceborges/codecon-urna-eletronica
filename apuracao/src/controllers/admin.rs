#![allow(clippy::unused_async)]
//! Admin HTML (CRUD) da apuração — telas server-side com Tera.
//! Cadastro de candidatos e urnas. Sem auth por enquanto (Fase 1).
use loco_rs::prelude::*;
use sea_orm::QueryOrder;
use serde::Deserialize;

use crate::models::_entities::{candidatos, urnas};

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
    format::view(&v, "admin/candidatos/list.html", data!({ "candidatos": items }))
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
async fn candidatos_delete(
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
) -> Result<Response> {
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
}
