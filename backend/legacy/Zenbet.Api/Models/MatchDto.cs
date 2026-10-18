using System.Text.Json.Serialization;

namespace Zenbet.Api.Models;

/// <summary>
/// Data Transfer Object (DTO) que representa un encuentro de fútbol en la cartelera deportiva de Zenbet.
/// 
/// NOTA DE ARQUITECTURA:
/// Las cuotas (OddHome, OddDraw, OddAway) utilizan estrictamente el tipo de dato 'decimal' en C#
/// para mapear de forma 1:1 con las columnas 'NUMERIC(8,4)' de PostgreSQL a través del provider Npgsql.
/// Esto previene pérdida de precisión aritmética y excepciones de casteo (InvalidCastException)
/// típicas del uso indebido de float o double en aplicaciones financieras.
/// </summary>
public class MatchDto
{
    /// <summary>
    /// Identificador único del partido en la base de datos.
    /// </summary>
    [JsonPropertyName("id")]
    public int Id { get; set; }

    /// <summary>
    /// Nombre del equipo local.
    /// </summary>
    [JsonPropertyName("homeTeam")]
    public string HomeTeam { get; set; } = string.Empty;

    /// <summary>
    /// Nombre del equipo visitante.
    /// </summary>
    [JsonPropertyName("awayTeam")]
    public string AwayTeam { get; set; } = string.Empty;

    /// <summary>
    /// Nombre de la liga o competición (ej. LaLiga EA Sports, Premier League).
    /// </summary>
    [JsonPropertyName("league")]
    public string League { get; set; } = string.Empty;

    /// <summary>
    /// Fecha y hora UTC del inicio del encuentro (mapeado de TIMESTAMPTZ).
    /// </summary>
    [JsonPropertyName("startTime")]
    public DateTime StartTime { get; set; }

    /// <summary>
    /// Cuota decimal para la victoria del equipo local (1).
    /// </summary>
    [JsonPropertyName("oddHome")]
    public decimal OddHome { get; set; }

    /// <summary>
    /// Cuota decimal para el empate (X).
    /// </summary>
    [JsonPropertyName("oddDraw")]
    public decimal OddDraw { get; set; }

    /// <summary>
    /// Cuota decimal para la victoria del equipo visitante (2).
    /// </summary>
    [JsonPropertyName("oddAway")]
    public decimal OddAway { get; set; }
}
