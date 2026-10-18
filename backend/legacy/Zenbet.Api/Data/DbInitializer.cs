using Npgsql;

namespace Zenbet.Api.Data;

public class DbInitializer
{
    private readonly DbConnectionFactory _connectionFactory;
    private readonly ILogger<DbInitializer> _logger;

    public DbInitializer(DbConnectionFactory connectionFactory, ILogger<DbInitializer> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    public async Task InitializeDatabaseAsync()
    {
        try
        {
            _logger.LogInformation("Verificando e inicializando tablas de PostgreSQL para Zenbet...");
            await using var connection = await _connectionFactory.CreateOpenConnectionAsync();

            const string ddlScript = @"
                -- 1. Tabla: usuarios
                CREATE TABLE IF NOT EXISTS usuarios (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) NOT NULL UNIQUE,
                    email VARCHAR(100) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (balance >= 0),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
                CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);

                -- 2. Tabla: ledger
                CREATE TABLE IF NOT EXISTS ledger (
                    id SERIAL PRIMARY KEY,
                    user_id INT NOT NULL,
                    event_id VARCHAR(100) NOT NULL,
                    amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
                    odds NUMERIC(8, 4) NOT NULL CHECK (odds >= 1.0),
                    status VARCHAR(20) NOT NULL DEFAULT 'placed',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT fk_ledger_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON ledger(user_id);
                CREATE INDEX IF NOT EXISTS idx_ledger_event_id ON ledger(event_id);
                CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger(created_at DESC);

                -- 3. Tabla: audit_shadow_banned
                CREATE TABLE IF NOT EXISTS audit_shadow_banned (
                    id SERIAL PRIMARY KEY,
                    user_id INT,
                    original_odds NUMERIC(8, 4) NOT NULL,
                    effective_odds NUMERIC(8, 4) NOT NULL,
                    applied_delay_ms INT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT fk_audit_shadow_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL
                );
                CREATE INDEX IF NOT EXISTS idx_audit_shadow_user_id ON audit_shadow_banned(user_id);
                CREATE INDEX IF NOT EXISTS idx_audit_shadow_created_at ON audit_shadow_banned(created_at DESC);

                -- 4. Tabla: depositos_crypto
                CREATE TABLE IF NOT EXISTS depositos_crypto (
                    id SERIAL PRIMARY KEY,
                    tx_id VARCHAR(120) NOT NULL UNIQUE,
                    from_addr VARCHAR(120) NOT NULL,
                    amount NUMERIC(18, 6) NOT NULL,
                    status VARCHAR(30) NOT NULL DEFAULT 'confirmed',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_tx_id ON depositos_crypto(tx_id);
                CREATE INDEX IF NOT EXISTS idx_crypto_created_at ON depositos_crypto(created_at DESC);

                -- Usuario trader inicial para pruebas (Password: Zenbet2026!)
                INSERT INTO usuarios (username, email, password_hash, balance, created_at)
                VALUES (
                    'trader_zenbet',
                    'trader@zenbet.com',
                    '$2a$11$wK10RzO5G7XJmK8aP8tVXeQ6X2n1l9K3e7u9h5o2v0k6j4m8p1w3.',
                    1450.0000,
                    NOW()
                )
                ON CONFLICT (email) DO NOTHING;

                -- 5. Tabla: matches (Cartelera Deportiva de Fútbol)
                CREATE TABLE IF NOT EXISTS matches (
                    id SERIAL PRIMARY KEY,
                    home_team VARCHAR(100) NOT NULL,
                    away_team VARCHAR(100) NOT NULL,
                    league VARCHAR(100) NOT NULL,
                    start_time TIMESTAMPTZ NOT NULL,
                    odd_home NUMERIC(8, 4) NOT NULL CHECK (odd_home >= 1.0),
                    odd_draw NUMERIC(8, 4) NOT NULL CHECK (odd_draw >= 1.0),
                    odd_away NUMERIC(8, 4) NOT NULL CHECK (odd_away >= 1.0),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_matches_start_time ON matches(start_time);
                CREATE INDEX IF NOT EXISTS idx_matches_league ON matches(league);
                CREATE INDEX IF NOT EXISTS idx_matches_active_upcoming ON matches(start_time) WHERE start_time > NOW();

                -- Inserción de partidos de prueba de fútbol
                INSERT INTO matches (home_team, away_team, league, start_time, odd_home, odd_draw, odd_away)
                SELECT 'Real Madrid', 'FC Barcelona', 'LaLiga EA Sports', NOW() + INTERVAL '2 days' + INTERVAL '4 hours', 2.1500, 3.6000, 3.1000
                WHERE NOT EXISTS (
                    SELECT 1 FROM matches WHERE home_team = 'Real Madrid' AND away_team = 'FC Barcelona' AND start_time > NOW()
                );

                INSERT INTO matches (home_team, away_team, league, start_time, odd_home, odd_draw, odd_away)
                SELECT 'Manchester City', 'Arsenal FC', 'Premier League', NOW() + INTERVAL '3 days' + INTERVAL '6 hours', 1.9500, 3.5000, 3.8000
                WHERE NOT EXISTS (
                    SELECT 1 FROM matches WHERE home_team = 'Manchester City' AND away_team = 'Arsenal FC' AND start_time > NOW()
                );

                INSERT INTO matches (home_team, away_team, league, start_time, odd_home, odd_draw, odd_away)
                SELECT 'Bayern Múnich', 'Borussia Dortmund', 'Bundesliga', NOW() + INTERVAL '4 days' + INTERVAL '3 hours', 1.7500, 4.0000, 4.2500
                WHERE NOT EXISTS (
                    SELECT 1 FROM matches WHERE home_team = 'Bayern Múnich' AND away_team = 'Borussia Dortmund' AND start_time > NOW()
                );

                INSERT INTO matches (home_team, away_team, league, start_time, odd_home, odd_draw, odd_away)
                SELECT 'Paris Saint-Germain', 'Liverpool FC', 'UEFA Champions League', NOW() + INTERVAL '5 days' + INTERVAL '2 hours', 2.4500, 3.4000, 2.8000
                WHERE NOT EXISTS (
                    SELECT 1 FROM matches WHERE home_team = 'Paris Saint-Germain' AND away_team = 'Liverpool FC' AND start_time > NOW()
                );
            ";

            await using var command = new NpgsqlCommand(ddlScript, connection);
            await command.ExecuteNonQueryAsync();

            _logger.LogInformation("Base de datos Zenbet inicializada con éxito (Tablas e índices verificados).");
        }
        catch (Exception ex)
        {
            _logger.LogWarning("No se pudo autoinicializar la base de datos PostgreSQL automáticamente (¿servidor no iniciado?): {Message}. El script SQL permanece disponible en /Data/schema.sql.", ex.Message);
        }
    }
}
