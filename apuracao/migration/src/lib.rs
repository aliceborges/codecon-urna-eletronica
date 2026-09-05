#![allow(elided_lifetimes_in_paths)]
#![allow(clippy::wildcard_imports)]
pub use sea_orm_migration::prelude::*;
mod m20220101_000001_users;
mod m20260905_131353_candidatos;
mod m20260905_131448_urnas;
pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20220101_000001_users::Migration),
            Box::new(m20260905_131353_candidatos::Migration),
            Box::new(m20260905_131448_urnas::Migration),
            // inject-above (do not remove this comment)
        ]
    }
}
