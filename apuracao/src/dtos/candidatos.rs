use sea_orm::prelude::DateTimeWithTimeZone;
use ts_rs::TS;

#[derive(serde::Serialize, serde::Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/bindings/")]
pub struct CandidatoDto {
    #[ts(type = "number")]
    pub id: i64,
    pub numero: String,
    pub nome: String,
    pub partido: String,
    pub foto_svg: Option<String>,
    pub nome_vice: String,
    pub foto_vice_svg: Option<String>,
    #[ts(type = "string")]
    pub created_at: DateTimeWithTimeZone,
    #[ts(type = "string")]
    pub updated_at: DateTimeWithTimeZone,
}

impl From<crate::models::_entities::candidatos::Model> for CandidatoDto {
    fn from(m: crate::models::_entities::candidatos::Model) -> Self {
        Self {
            id: m.id,
            numero: m.numero,
            nome: m.nome,
            partido: m.partido,
            foto_svg: m.foto_svg,
            nome_vice: m.nome_vice,
            foto_vice_svg: m.foto_vice_svg,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/bindings/")]
pub struct CreateCandidato {
    pub numero: String,
    pub nome: String,
    pub partido: String,
    pub foto_svg: Option<String>,
    pub nome_vice: String,
    pub foto_vice_svg: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, TS)]
#[ts(export, export_to = "../frontend/src/bindings/")]
pub struct UpdateCandidato {
    pub numero: String,
    pub nome: String,
    pub partido: String,
    pub foto_svg: Option<String>,
    pub nome_vice: String,
    pub foto_vice_svg: Option<String>,
}
