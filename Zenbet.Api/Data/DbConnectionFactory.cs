using Npgsql;

namespace Zenbet.Api.Data;

public class DbConnectionFactory
{
    private readonly string _connectionString;

    public DbConnectionFactory(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=zenbet;Username=postgres;Password=postgres";
    }

    public NpgsqlConnection CreateConnection()
    {
        return new NpgsqlConnection(_connectionString);
    }

    public async Task<NpgsqlConnection> CreateOpenConnectionAsync(CancellationToken cancellationToken = default)
    {
        var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }
}
