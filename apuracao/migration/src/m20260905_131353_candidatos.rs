use loco_rs::schema::*;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(
            m,
            "candidatos",
            &[
                ("id", ColType::PkAuto),
                ("numero", ColType::StringUniq),
                ("nome", ColType::String),
                ("partido", ColType::String),
                ("foto_svg", ColType::TextNull),
                ("nome_vice", ColType::String),
                ("foto_vice_svg", ColType::TextNull),
            ],
            &[],
        )
        .await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "candidatos").await
    }
}
