use sea_orm::prelude::DateTimeWithTimeZone;
use ts_rs::TS;

#[derive(serde::Serialize, serde::Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/bindings/")]
pub struct UrnaDto {
    #[ts(type = "number")]
    pub id: i64,
    pub nome: String,
    pub chave_publica: String,
    #[ts(type = "string")]
    pub created_at: DateTimeWithTimeZone,
    #[ts(type = "string")]
    pub updated_at: DateTimeWithTimeZone,
}

impl From<crate::models::_entities::urnas::Model> for UrnaDto {
    fn from(m: crate::models::_entities::urnas::Model) -> Self {
        Self {
            id: m.id,
            nome: m.nome,
            chave_publica: m.chave_publica,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/bindings/")]
pub struct CreateUrna {
    pub nome: String,
    pub chave_publica: String,
}

#[derive(serde::Serialize, serde::Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/bindings/")]
pub struct UpdateUrna {
    pub nome: String,
    pub chave_publica: String,
}
