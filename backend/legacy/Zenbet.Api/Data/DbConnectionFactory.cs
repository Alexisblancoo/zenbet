using Npgsql;

namespace Zenbet.Api.Data;

public class DbConnectionFactory
{
    private readonly string _connectionString;

    public DbConnectionFactory(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=zenbet;Username=postgres;Password=1;Include Error Detail=true";
    }

    public NpgsqlConnection CreateConnection()
    {
        return new NpgsqlConnection(_connectionString);
    }

    public async Task<NpgsqlConnection> CreateOpenConnectionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);
            return connection;
        }
        catch (PostgresException ex) when (ex.SqlState == "28P01")
        {
            var fallbackCs = _connectionString.Contains("Password=postgres")
                ? _connectionString.Replace("Password=postgres", "Password=1")
                : _connectionString.Contains("Password=1")
                    ? _connectionString.Replace("Password=1", "Password=postgres")
                    : null;

            if (fallbackCs != null)
            {
                var fallbackConn = new NpgsqlConnection(fallbackCs);
                await fallbackConn.OpenAsync(cancellationToken);
                return fallbackConn;
            }

            throw;
        }
    }
}
