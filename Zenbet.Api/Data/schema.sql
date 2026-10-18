-- ==============================================================================
-- ZENBET PLATFORM - POSTGRESQL ARCHITECTURAL SCHEMA
-- High-Concurrency Financial Ledger, User Accounts, Shadow-Banning & Crypto Auditing
-- ==============================================================================

-- 1. TABLA: usuarios
-- Almacena credenciales, balances en cuenta y marcas temporales con bloqueo pesimista
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de consulta de alta frecuencia para autenticación
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);

-- 2. TABLA: ledger
-- Registro inmutable de transacciones financieras ACID por usuario y evento
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

-- Índices de alto rendimiento para auditorías contables y liquidación de apuestas
CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_event_id ON ledger(event_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger(created_at DESC);

-- 3. TABLA: audit_shadow_banned
-- Registro de auditoría para eventos con cuota >= 2.50 (latencia artificial y deslizamiento del 5%)
CREATE TABLE IF NOT EXISTS audit_shadow_banned (
    id SERIAL PRIMARY KEY,
    user_id INT,
    original_odds NUMERIC(8, 4) NOT NULL,
    effective_odds NUMERIC(8, 4) NOT NULL,
    applied_delay_ms INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_audit_shadow_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Índices para monitoreo y análisis antifraude
CREATE INDEX IF NOT EXISTS idx_audit_shadow_user_id ON audit_shadow_banned(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_shadow_created_at ON audit_shadow_banned(created_at DESC);

-- 4. TABLA: depositos_crypto
-- Registro de depósitos TRC20 (USDT) procesados por el listener
CREATE TABLE IF NOT EXISTS depositos_crypto (
    id SERIAL PRIMARY KEY,
    tx_id VARCHAR(120) NOT NULL UNIQUE,
    from_addr VARCHAR(120) NOT NULL,
    amount NUMERIC(18, 6) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices únicos y de búsqueda cronológica para transacciones blockchain
CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_tx_id ON depositos_crypto(tx_id);
CREATE INDEX IF NOT EXISTS idx_crypto_created_at ON depositos_crypto(created_at DESC);

-- ==============================================================================
-- SEMILLA INICIAL DE PRUEBA (Usuario Trader con balance inicial $1,450.00 USD)
-- Password en texto plano: Zenbet2026!
-- Hash generado con BCrypt.Net (work factor 11):
-- ==============================================================================
INSERT INTO usuarios (username, email, password_hash, balance, created_at)
VALUES (
    'trader_zenbet',
    'trader@zenbet.com',
    '$2a$11$wK10RzO5G7XJmK8aP8tVXeQ6X2n1l9K3e7u9h5o2v0k6j4m8p1w3.',
    1450.0000,
    NOW()
)
ON CONFLICT (email) DO UPDATE 
SET balance = EXCLUDED.balance;
