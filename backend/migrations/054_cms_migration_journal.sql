-- Outbox local: o conteúdo e seu SQL são confirmados na mesma transação.
-- Produção recebe apenas as migrations exportadas, não os registros deste journal.
CREATE TABLE cms_migration_journal (
  name text PRIMARY KEY,
  sql text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  exported_at timestamptz
);
CREATE INDEX cms_migration_journal_pending ON cms_migration_journal (name)
  WHERE exported_at IS NULL;
