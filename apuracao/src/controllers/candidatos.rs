#![allow(clippy::unused_async)]
use axum::http::StatusCode;
use loco_rs::prelude::*;
use sea_orm::QueryOrder;

use crate::{
    dtos::{
        candidatos::{CandidatoDto, CreateCandidato, UpdateCandidato},
        common::{ApiError, Page},
    },
    models::_entities::candidatos::{ActiveModel, Column, Entity},
};

/// Build a 404 response shaped as the [`ApiError`] envelope.
fn not_found(message: &str) -> Response {
    let error = ApiError {
        code: "not_found".to_string(),
        message: message.to_string(),
        details: None,
    };
    (StatusCode::NOT_FOUND, Json(error)).into_response()
}

#[debug_handler]
async fn list(
    State(ctx): State<AppContext>,
    Query(pagination): Query<query::PaginationQuery>,
) -> Result<Json<Page<CandidatoDto>>> {
    let res = query::paginate(
        &ctx.db,
        Entity::find().order_by_asc(Column::Id),
        None,
        &pagination,
    )
    .await?;

    Ok(Json(Page::from_query(res)))
}

#[debug_handler]
async fn get_one(State(ctx): State<AppContext>, Path(id): Path<i64>) -> Result<Response> {
    let Some(model) = Entity::find_by_id(id).one(&ctx.db).await? else {
        return Ok(not_found("candidato not found"));
    };
    Ok(Json(CandidatoDto::from(model)).into_response())
}

#[debug_handler]
async fn create(
    State(ctx): State<AppContext>,
    Json(params): Json<CreateCandidato>,
) -> Result<Response> {
    let item = ActiveModel {
        numero: Set(params.numero),
        nome: Set(params.nome),
        partido: Set(params.partido),
        foto_svg: Set(params.foto_svg),
        nome_vice: Set(params.nome_vice),
        foto_vice_svg: Set(params.foto_vice_svg),
        ..Default::default()
    };
    let item = item.insert(&ctx.db).await?;

    Ok((StatusCode::CREATED, Json(CandidatoDto::from(item))).into_response())
}

#[debug_handler]
async fn update(
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
    Json(params): Json<UpdateCandidato>,
) -> Result<Response> {
    let Some(model) = Entity::find_by_id(id).one(&ctx.db).await? else {
        return Ok(not_found("candidato not found"));
    };

    let mut item = model.into_active_model();
    item.numero = Set(params.numero);
    item.nome = Set(params.nome);
    item.partido = Set(params.partido);
    item.foto_svg = Set(params.foto_svg);
    item.nome_vice = Set(params.nome_vice);
    item.foto_vice_svg = Set(params.foto_vice_svg);
    let item = item.update(&ctx.db).await?;

    Ok(Json(CandidatoDto::from(item)).into_response())
}

#[debug_handler]
async fn remove(State(ctx): State<AppContext>, Path(id): Path<i64>) -> Result<Response> {
    let Some(model) = Entity::find_by_id(id).one(&ctx.db).await? else {
        return Ok(not_found("candidato not found"));
    };

    model.into_active_model().delete(&ctx.db).await?;

    Ok(StatusCode::NO_CONTENT.into_response())
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("/api/candidatos")
        .add("/", get(list))
        .add("/", post(create))
        .add("/{id}", get(get_one))
        .add("/{id}", put(update))
        .add("/{id}", delete(remove))
}
