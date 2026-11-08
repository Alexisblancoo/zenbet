/**
 * Fixtures sintéticos para validar `UniversalMatchAnalysisSchema`.
 *
 * No describen eventos reales ni se muestran en la UI: existen únicamente para
 * probar el contrato Zod. Cualquier dato visible para el jugador debe venir de
 * la API (regla "nada simulado").
 */

import type {
  BasketballAnalysis,
  BoxingAnalysis,
  SoccerAnalysis,
  TennisAnalysis,
} from '@/modules/Sportsbook/components/UniversalAnalysisCard';

const LOGO = 'https://example.com/fixture-team.svg';
const PHOTO = 'https://example.com/fixture-athlete.png';

const TELEMETRY = {
  modelIdentifier: 'Fixture-Contract-Test',
  inferenceLatencyMs: 1,
  generatedAt: '2026-01-01T00:00:00.000Z',
};

const BET_ANGLE = {
  marketType: 'Fixture Market',
  selectionName: 'Fixture Selection',
  suggestedLine: 'Cuota 1.90',
  confidenceGrade: 'B',
  riskLevel: 'MODERATE',
  rationale: 'Texto sintético para pruebas de contrato, sin valor informativo.',
} as const;

export const SOCCER_ANALYSIS_FIXTURE: SoccerAnalysis = {
  sportType: 'soccer',
  id: 'test-soccer-001',
  competition: 'Fixture sintético // Contrato Zod',
  scheduledStartTime: '2026-01-01T12:00:00Z',
  venue: 'Estadio de pruebas',
  status: 'UPCOMING',
  headline: 'FIXTURE SINTÉTICO DE FÚTBOL',
  summary:
    'Payload sintético usado solo para validar el contrato Zod; no describe ningún evento real.',
  modelConfidence: 'HIGH',
  homeTeam: {
    name: 'Equipo Local FC',
    logoUrl: LOGO,
    leaguePosition: 'Fixture',
    formLast5: ['W', 'D', 'L'],
  },
  awayTeam: {
    name: 'Equipo Visitante FC',
    logoUrl: LOGO,
    leaguePosition: 'Fixture',
    formLast5: ['L', 'W', 'D'],
  },
  metrics: {
    possessionProjection: { homePercent: 50, awayPercent: 50 },
    shotsOnTarget: { homeShots: 4, awayShots: 4 },
    expectedGoals: { homeXG: 1.2, awayXG: 1.2 },
    bttsProbabilityPercent: 50,
  },
  odds1X2: { home: 2.5, draw: 3.2, away: 2.8 },
  probabilities: { homeWin: 40, draw: 25, awayWin: 35 },
  tacticalKeys: ['Clave sintética uno.', 'Clave sintética dos.'],
  recommendedBetAngle: BET_ANGLE,
  llmTelemetry: TELEMETRY,
};

export const BASKETBALL_ANALYSIS_FIXTURE: BasketballAnalysis = {
  sportType: 'basketball',
  id: 'test-basketball-001',
  competition: 'Fixture sintético // Contrato Zod',
  scheduledStartTime: '2026-01-02T12:00:00Z',
  venue: 'Pabellón de pruebas',
  status: 'UPCOMING',
  headline: 'FIXTURE SINTÉTICO DE BÁSQUETBOL',
  summary:
    'Payload sintético usado solo para validar el contrato Zod; no describe ningún evento real.',
  modelConfidence: 'HIGH',
  homeTeam: {
    name: 'Local Basket',
    logoUrl: LOGO,
    conferenceRank: 'Fixture',
    offensiveRatingRank: 1,
  },
  awayTeam: {
    name: 'Visitante Basket',
    logoUrl: LOGO,
    conferenceRank: 'Fixture',
    offensiveRatingRank: 2,
  },
  metrics: {
    threePointPct: { homePct: 35, awayPct: 34 },
    projectedRebounds: { homeRebounds: 40, awayRebounds: 40 },
    paceRating: { projectedPossessions: 100, paceStyle: 'BALANCED' },
    overUnderTotalLine: 220.5,
  },
  oddsMoneyline: { home: 1.9, away: 1.9 },
  spread: { favoredTeam: 'home', points: -1.5, decimal: 1.9 },
  probabilities: { homeWin: 50, awayWin: 50 },
  tacticalKeys: ['Clave sintética uno.', 'Clave sintética dos.'],
  recommendedBetAngle: BET_ANGLE,
  llmTelemetry: TELEMETRY,
};

export const TENNIS_ANALYSIS_FIXTURE: TennisAnalysis = {
  sportType: 'tennis',
  id: 'test-tennis-001',
  competition: 'Fixture sintético // Contrato Zod',
  scheduledStartTime: '2026-01-03T12:00:00Z',
  venue: 'Pista de pruebas',
  status: 'UPCOMING',
  headline: 'FIXTURE SINTÉTICO DE TENIS',
  summary:
    'Payload sintético usado solo para validar el contrato Zod; no describe ningún evento real.',
  modelConfidence: 'HIGH',
  surface: 'HARD',
  playerOne: {
    name: 'Jugador Uno',
    country: 'XXX',
    atpRanking: 1,
    photoUrl: PHOTO,
    dominantHand: 'Right',
  },
  playerTwo: {
    name: 'Jugador Dos',
    country: 'YYY',
    atpRanking: 2,
    photoUrl: PHOTO,
    dominantHand: 'Left',
  },
  metrics: {
    firstServePct: { playerOne: 60, playerTwo: 61 },
    projectedAces: { playerOne: 5, playerTwo: 6 },
    breakPointConversionPct: { playerOne: 40, playerTwo: 41 },
  },
  oddsWinner: { playerOne: 1.9, playerTwo: 1.9 },
  probabilities: { playerOneWin: 50, playerTwoWin: 50 },
  projectedSets: 'Fixture 2-1',
  tacticalKeys: ['Clave sintética uno.', 'Clave sintética dos.'],
  recommendedBetAngle: BET_ANGLE,
  llmTelemetry: TELEMETRY,
};

export const BOXING_ANALYSIS_FIXTURE: BoxingAnalysis = {
  sportType: 'boxing',
  id: 'test-boxing-001',
  competition: 'Fixture sintético // Contrato Zod',
  scheduledStartTime: '2026-01-04T12:00:00Z',
  venue: 'Ring de pruebas',
  status: 'UPCOMING',
  headline: 'FIXTURE SINTÉTICO DE BOXEO',
  summary:
    'Payload sintético usado solo para validar el contrato Zod; no describe ningún evento real.',
  modelConfidence: 'HIGH',
  weightClass: 'Fixture Weight',
  scheduledRounds: 3,
  redCorner: {
    name: 'Boxeador Rojo',
    nickname: 'Fixture',
    record: '0-0-0',
    reachInches: 70,
    photoUrl: PHOTO,
    fighterStyle: 'OUT_BOXER',
  },
  blueCorner: {
    name: 'Boxeador Azul',
    nickname: 'Fixture',
    record: '0-0-0',
    reachInches: 70,
    photoUrl: PHOTO,
    fighterStyle: 'STRIKER',
  },
  metrics: {
    reachAdvantageInches: 0,
    takedownDefenseOrGuardPct: { redCorner: 50, blueCorner: 50 },
    significantStrikesPerMin: { redCorner: 5, blueCorner: 5 },
    clashDynamic: 'Fixture sintético.',
  },
  oddsWinner: { red: 1.9, blue: 1.9 },
  probabilities: { redWin: 50, blueWin: 50 },
  projectedMethod: 'DECISION',
  tacticalKeys: ['Clave sintética uno.', 'Clave sintética dos.'],
  recommendedBetAngle: BET_ANGLE,
  llmTelemetry: TELEMETRY,
};
