use loco_rs::schema::*;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        create_table(
            m,
            "poll_reports",
            &[
                ("id", ColType::PkAuto),
                ("urna_id", ColType::BigInteger),
                ("terminal_id", ColType::StringNull),
                ("total", ColType::BigInteger),
                ("tally_json", ColType::Text),
                ("hash", ColType::String),
                ("issued_at", ColType::StringNull),
            ],
            &[],
        )
        .await
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        drop_table(m, "poll_reports").await
    }
}
