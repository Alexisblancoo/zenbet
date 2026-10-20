using Microsoft.AspNetCore.Mvc;
using Npgsql;
using Zenbet.Api.Data;
using Zenbet.Api.Models;

namespace Zenbet.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly DbConnectionFactory _connectionFactory;
    private readonly ILogger<AuthController> _logger;

    public AuthController(DbConnectionFactory connectionFactory, ILogger<AuthController> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    /// <summary>
    /// Registro seguro de usuario con encriptación BCrypt y validación estricta de términos legales.
    /// </summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { status = "error", message = "Datos de registro inválidos", errors = ModelState });
        }

        if (!request.TermsAccepted)
        {
            return BadRequest(new
            {
                status = "error",
                message = "Debe aceptar obligatoriamente los Términos y Condiciones y la Política de Privacidad para registrarse."
            });
        }

        try
        {
            await using var connection = await _connectionFactory.CreateOpenConnectionAsync();

            // Verificar si el usuario o email ya existen
            const string checkQuery = @"
                SELECT COUNT(*) 
                FROM usuarios 
                WHERE email = @email OR username = @username;
            ";

            await using (var checkCmd = new NpgsqlCommand(checkQuery, connection))
            {
                checkCmd.Parameters.AddWithValue("email", request.Email.Trim().ToLowerInvariant());
                checkCmd.Parameters.AddWithValue("username", request.Username.Trim());

                var count = Convert.ToInt64(await checkCmd.ExecuteScalarAsync());
                if (count > 0)
                {
                    return Conflict(new
                    {
                        status = "error",
                        message = "El correo electrónico o nombre de usuario ya se encuentra registrado."
                    });
                }
            }

            // Encriptación segura de contraseña usando BCrypt
            string passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 11);

            // Inserción en la base de datos PostgreSQL
            const string insertQuery = @"
                INSERT INTO usuarios (username, email, password_hash, balance, created_at)
                VALUES (@username, @email, @passwordHash, @balance, NOW())
                RETURNING id, username, email, balance, created_at;
            ";

            await using var insertCmd = new NpgsqlCommand(insertQuery, connection);
            insertCmd.Parameters.AddWithValue("username", request.Username.Trim());
            insertCmd.Parameters.AddWithValue("email", request.Email.Trim().ToLowerInvariant());
            insertCmd.Parameters.AddWithValue("passwordHash", passwordHash);
            insertCmd.Parameters.AddWithValue("balance", request.InitialBalance);

            await using var reader = await insertCmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                var user = new UserDto
                {
                    Id = reader.GetInt32(0),
                    Username = reader.GetString(1),
                    Email = reader.GetString(2),
                    Balance = reader.GetDecimal(3),
                    CreatedAt = reader.GetDateTime(4)
                };

                // Token de sesión representativo (compatible con el formato local zenbet_token)
                string simulatedToken = Convert.ToBase64String(Guid.NewGuid().ToByteArray()) + "." + user.Id;

                return StatusCode(StatusCodes.Status201Created, new AuthResponse
                {
                    Status = "success",
                    Message = "Usuario registrado exitosamente con términos legales aceptados.",
                    Token = simulatedToken,
                    User = user
                });
            }

            return StatusCode(500, new { status = "error", message = "No se pudo crear el usuario." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error durante el registro de usuario: {Message}", ex.Message);
            return StatusCode(500, new { status = "error", message = "Error de base de datos durante el registro: " + ex.Message });
        }
    }

    /// <summary>
    /// Inicio de sesión seguro con verificación de hash BCrypt.
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { status = "error", message = "Datos de inicio de sesión incompletos" });
        }

        try
        {
            await using var connection = await _connectionFactory.CreateOpenConnectionAsync();

            const string selectQuery = @"
                SELECT id, username, email, password_hash, balance, created_at
                FROM usuarios 
                WHERE email = @identifier OR username = @identifier;
            ";

            await using var cmd = new NpgsqlCommand(selectQuery, connection);
            cmd.Parameters.AddWithValue("identifier", request.Identifier.Trim());

            await using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
            {
                return Unauthorized(new { status = "error", message = "Credenciales incorrectas (usuario no encontrado)." });
            }

            int id = reader.GetInt32(0);
            string username = reader.GetString(1);
            string email = reader.GetString(2);
            string passwordHash = reader.GetString(3);
            decimal balance = reader.GetDecimal(4);
            DateTime createdAt = reader.GetDateTime(5);

            // Verificación criptográfica con BCrypt
            bool passwordMatches = BCrypt.Net.BCrypt.Verify(request.Password, passwordHash);
            if (!passwordMatches)
            {
                return Unauthorized(new { status = "error", message = "Credenciales incorrectas (contraseña inválida)." });
            }

            string simulatedToken = Convert.ToBase64String(Guid.NewGuid().ToByteArray()) + "." + id;

            return Ok(new AuthResponse
            {
                Status = "success",
                Message = "Sesión iniciada correctamente.",
                Token = simulatedToken,
                User = new UserDto
                {
                    Id = id,
                    Username = username,
                    Email = email,
                    Balance = balance,
                    CreatedAt = createdAt
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error durante el inicio de sesión: {Message}", ex.Message);
            return StatusCode(500, new { status = "error", message = "Error de conexión en autenticación: " + ex.Message });
        }
    }

    /// <summary>
    /// Obtiene el balance actualizado en tiempo real para sincronización de Header.
    /// </summary>
    [HttpGet("balance/{userId:int}")]
    public async Task<IActionResult> GetBalance(int userId)
    {
        try
        {
            await using var connection = await _connectionFactory.CreateOpenConnectionAsync();
            const string balanceQuery = "SELECT balance FROM usuarios WHERE id = @id;";

            await using var cmd = new NpgsqlCommand(balanceQuery, connection);
            cmd.Parameters.AddWithValue("id", userId);

            var result = await cmd.ExecuteScalarAsync();
            if (result == null || result == DBNull.Value)
            {
                return NotFound(new { status = "error", message = "Usuario no encontrado" });
            }

            return Ok(new
            {
                status = "success",
                userId,
                balance = Convert.ToDecimal(result)
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { status = "error", message = ex.Message });
        }
    }
}
