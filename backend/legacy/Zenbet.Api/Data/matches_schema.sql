-- ==============================================================================
-- ZENBET PLATFORM - SPORTS BILLBOARD (FOOTBALL) SCHEMA & SEED DATA
-- Módulo de Cartelera Deportiva: Tabla 'matches' y partidos de prueba
-- ==============================================================================

-- 1. CREACIÓN DE LA TABLA: matches
-- Almacena los encuentros de fútbol, ligas, fechas de inicio y cuotas decimales
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

-- 2. ÍNDICES DE ALTO RENDIMIENTO
-- Optimización para consultas frecuentes de partidos activos y filtrado por liga
CREATE INDEX IF NOT EXISTS idx_matches_start_time ON matches(start_time);
CREATE INDEX IF NOT EXISTS idx_matches_league ON matches(league);
CREATE INDEX IF NOT EXISTS idx_matches_active_upcoming ON matches(start_time) WHERE start_time > NOW();

-- 3. INSERCIÓN DE PARTIDOS DE PRUEBA (ACTIVOS / FECHA FUTURA)
-- Inserciones idempotentes (no duplican si ya existen los equipos)

INSERT INTO matches (home_team, away_team, league, start_time, odd_home, odd_draw, odd_away)
SELECT 'Real Madrid', 'FC Barcelona', 'LaLiga EA Sports', NOW() + INTERVAL '2 days' + INTERVAL '4 hours', 2.1500, 3.6000, 3.1000
WHERE NOT EXISTS (
    SELECT 1 FROM matches 
    WHERE home_team = 'Real Madrid' AND away_team = 'FC Barcelona' AND start_time > NOW()
);

INSERT INTO matches (home_team, away_team, league, start_time, odd_home, odd_draw, odd_away)
SELECT 'Manchester City', 'Arsenal FC', 'Premier League', NOW() + INTERVAL '3 days' + INTERVAL '6 hours', 1.9500, 3.5000, 3.8000
WHERE NOT EXISTS (
    SELECT 1 FROM matches 
    WHERE home_team = 'Manchester City' AND away_team = 'Arsenal FC' AND start_time > NOW()
);

INSERT INTO matches (home_team, away_team, league, start_time, odd_home, odd_draw, odd_away)
SELECT 'Bayern Múnich', 'Borussia Dortmund', 'Bundesliga', NOW() + INTERVAL '4 days' + INTERVAL '3 hours', 1.7500, 4.0000, 4.2500
WHERE NOT EXISTS (
    SELECT 1 FROM matches 
    WHERE home_team = 'Bayern Múnich' AND away_team = 'Borussia Dortmund' AND start_time > NOW()
);

INSERT INTO matches (home_team, away_team, league, start_time, odd_home, odd_draw, odd_away)
SELECT 'Paris Saint-Germain', 'Liverpool FC', 'UEFA Champions League', NOW() + INTERVAL '5 days' + INTERVAL '2 hours', 2.4500, 3.4000, 2.8000
WHERE NOT EXISTS (
    SELECT 1 FROM matches 
    WHERE home_team = 'Paris Saint-Germain' AND away_team = 'Liverpool FC' AND start_time > NOW()
);
