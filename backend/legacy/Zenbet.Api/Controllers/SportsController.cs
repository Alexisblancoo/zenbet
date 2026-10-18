using Microsoft.AspNetCore.Mvc;
using Npgsql;
using Zenbet.Api.Data;
using Zenbet.Api.Models;

namespace Zenbet.Api.Controllers;

/// <summary>
/// Controlador de la Cartelera de Deportes de Zenbet.
/// 
/// NOTA DE ARQUITECTURA:
/// Para evitar colisiones de concurrencia y fugas en el pool de conexiones (Connection Pooling),
/// este controlador NO inyecta directamente una instancia de 'NpgsqlConnection' con ciclo de vida Scoped o Transient.
/// En su lugar, consume 'DbConnectionFactory' (Singleton) y gestiona el ciclo de vida de cada conexión
/// de forma explícita y asíncrona mediante bloques 'await using'.
/// </summary>
[ApiController]
[Route("api/sports")]
public class SportsController : ControllerBase
{
    private readonly DbConnectionFactory _connectionFactory;
    private readonly ILogger<SportsController> _logger;

    public SportsController(
        DbConnectionFactory connectionFactory,
        ILogger<SportsController> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene el listado de partidos de fútbol activos (start_time > NOW()).
    /// Permite filtrado opcional por liga y ordenamiento cronológico ascendente.
    /// 
    /// Ruta: GET api/sports/football
    /// Query param opcional: ?league=LaLiga%20EA%20Sports
    /// </summary>
    /// <param name="league">Nombre opcional de la liga para filtrar los encuentros.</param>
    /// <param name="cancellationToken">Token de cancelación cooperativa de la petición HTTP.</param>
    /// <returns>Lista de partidos activos en formato JSON.</returns>
    [HttpGet("football")]
    [HttpGet("/api/sports/football")]
    [ProducesResponseType(typeof(List<MatchDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetFootballMatches(
        [FromQuery] string? league = null,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[SPORTS_CONTROLLER] Solicitando partidos de fútbol activos. Filtro de liga: {League}",
            string.IsNullOrWhiteSpace(league) ? "TODAS" : league.Trim());

        var matches = new List<MatchDto>();

        try
        {
            // 1. Apertura segura y aislada de conexión por petición usando DbConnectionFactory
            await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);

            // 2. Consulta SQL parametrizada con filtro temporal y soporte de búsqueda por liga
            const string sql = @"
                SELECT id, home_team, away_team, league, start_time, odd_home, odd_draw, odd_away
                FROM matches
                WHERE start_time > NOW()
                  AND (@league IS NULL OR LOWER(league) = LOWER(@league))
                ORDER BY start_time ASC;
            ";

            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddWithValue("league", string.IsNullOrWhiteSpace(league) ? (object)DBNull.Value : league.Trim());

            // 3. Lectura asíncrona mediante NpgsqlDataReader
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                matches.Add(new MatchDto
                {
                    Id = reader.GetInt32(0),
                    HomeTeam = reader.GetString(1),
                    AwayTeam = reader.GetString(2),
                    League = reader.GetString(3),
                    StartTime = reader.GetDateTime(4),
                    // Mapeo seguro directo de NUMERIC(8,4) a decimal en C#
                    OddHome = reader.GetDecimal(5),
                    OddDraw = reader.GetDecimal(6),
                    OddAway = reader.GetDecimal(7)
                });
            }

            _logger.LogInformation("[SPORTS_CONTROLLER] Se retornaron exitosamente {Count} partidos activos.", matches.Count);

            return Ok(matches);
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("[SPORTS_CONTROLLER] Operación cancelada por el cliente HTTP.");
            return StatusCode(499); // Client Closed Request
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SPORTS_CONTROLLER] Error al consultar la cartelera de fútbol: {Message}", ex.Message);
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                status = "error",
                message = "Error interno al recuperar los partidos de la cartelera: " + ex.Message
            });
        }
    }

    /// <summary>
    /// Obtiene el detalle de un partido de fútbol específico por su ID.
    /// Ruta: GET api/sports/football/{id}
    /// </summary>
    [HttpGet("football/{id:int}")]
    [HttpGet("/api/sports/football/{id:int}")]
    [ProducesResponseType(typeof(MatchDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetMatchById(int id, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);

            const string sql = @"
                SELECT id, home_team, away_team, league, start_time, odd_home, odd_draw, odd_away
                FROM matches
                WHERE id = @id;
            ";

            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddWithValue("id", id);

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            if (await reader.ReadAsync(cancellationToken))
            {
                var match = new MatchDto
                {
                    Id = reader.GetInt32(0),
                    HomeTeam = reader.GetString(1),
                    AwayTeam = reader.GetString(2),
                    League = reader.GetString(3),
                    StartTime = reader.GetDateTime(4),
                    OddHome = reader.GetDecimal(5),
                    OddDraw = reader.GetDecimal(6),
                    OddAway = reader.GetDecimal(7)
                };

                return Ok(match);
            }

            return NotFound(new { status = "error", message = $"No se encontró el partido con ID {id}." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SPORTS_CONTROLLER] Error al consultar el partido {Id}: {Message}", id, ex.Message);
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                status = "error",
                message = "Error interno al consultar el partido: " + ex.Message
            });
        }
    }
}
