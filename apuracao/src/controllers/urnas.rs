#![allow(clippy::unused_async)]
use axum::http::StatusCode;
use loco_rs::prelude::*;
use sea_orm::QueryOrder;

use crate::{
    dtos::{
        common::{ApiError, Page},
        urnas::{CreateUrna, UpdateUrna, UrnaDto},
    },
    models::_entities::urnas::{ActiveModel, Column, Entity},
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
) -> Result<Json<Page<UrnaDto>>> {
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
        return Ok(not_found("urna not found"));
    };
    Ok(Json(UrnaDto::from(model)).into_response())
}

#[debug_handler]
async fn create(State(ctx): State<AppContext>, Json(params): Json<CreateUrna>) -> Result<Response> {
    let item = ActiveModel {
        nome: Set(params.nome),
        chave_publica: Set(params.chave_publica),
        ..Default::default()
    };
    let item = item.insert(&ctx.db).await?;

    Ok((StatusCode::CREATED, Json(UrnaDto::from(item))).into_response())
}

#[debug_handler]
async fn update(
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
    Json(params): Json<UpdateUrna>,
) -> Result<Response> {
    let Some(model) = Entity::find_by_id(id).one(&ctx.db).await? else {
        return Ok(not_found("urna not found"));
    };

    let mut item = model.into_active_model();
    item.nome = Set(params.nome);
    item.chave_publica = Set(params.chave_publica);
    let item = item.update(&ctx.db).await?;

    Ok(Json(UrnaDto::from(item)).into_response())
}

#[debug_handler]
async fn remove(State(ctx): State<AppContext>, Path(id): Path<i64>) -> Result<Response> {
    let Some(model) = Entity::find_by_id(id).one(&ctx.db).await? else {
        return Ok(not_found("urna not found"));
    };

    model.into_active_model().delete(&ctx.db).await?;

    Ok(StatusCode::NO_CONTENT.into_response())
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("/api/urnas")
        .add("/", get(list))
        .add("/", post(create))
        .add("/{id}", get(get_one))
        .add("/{id}", put(update))
        .add("/{id}", delete(remove))
}
