use sea_orm_migration::prelude::*;
use sea_orm_migration::sea_orm::ConnectionTrait;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, m: &SchemaManager) -> Result<(), DbErr> {
        let db = m.get_connection();
        // Remove duplicados existentes, mantendo o boletim mais recente (maior id) por urna.
        db.execute_unprepared(
            "DELETE FROM poll_reports WHERE id NOT IN \
             (SELECT MAX(id) FROM poll_reports GROUP BY urna_id)",
        )
        .await?;
        // Garante no máximo um boletim (uma apuração) por urna.
        db.execute_unprepared(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_reports_urna_id \
             ON poll_reports (urna_id)",
        )
        .await?;
        Ok(())
    }

    async fn down(&self, m: &SchemaManager) -> Result<(), DbErr> {
        m.get_connection()
            .execute_unprepared("DROP INDEX IF EXISTS idx_poll_reports_urna_id")
            .await?;
        Ok(())
    }
}
