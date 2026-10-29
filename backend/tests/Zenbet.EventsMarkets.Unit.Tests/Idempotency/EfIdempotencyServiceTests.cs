namespace Zenbet.EventsMarkets.Unit.Tests.Idempotency;

using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Services;
using Xunit;

public sealed class EfIdempotencyServiceTests
{
    [Fact]
    public async Task Existing_Key_Allows_Replay_Only_For_The_Same_Command_And_Payload()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<EventsMarketsDbContext>()
            .UseSqlite(connection)
            .Options;

        await using var dbContext = new EventsMarketsDbContext(options);
        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE TABLE idempotency_keys (
                key TEXT NOT NULL PRIMARY KEY,
                command_type TEXT NOT NULL,
                payload_hash TEXT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            """);

        var service = new EfIdempotencyService(dbContext);
        const string key = "test-key";
        const string commandType = "PlaceBetCommand";
        const string originalHash = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        const string changedHash = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

        await service.AddAsync(key, commandType, payloadHash: originalHash);

        Assert.True(await service.ExistsAsync(key, commandType, originalHash));
        await Assert.ThrowsAsync<IdempotencyConflictException>(
            () => service.ExistsAsync(key, commandType, changedHash));
        await Assert.ThrowsAsync<IdempotencyConflictException>(
            () => service.ExistsAsync(key, "RequestDepositCommand", originalHash));
    }

    [Fact]
    public async Task Legacy_Key_Without_Payload_Hash_Is_Rejected()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<EventsMarketsDbContext>()
            .UseSqlite(connection)
            .Options;

        await using var dbContext = new EventsMarketsDbContext(options);
        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE TABLE idempotency_keys (
                key TEXT NOT NULL PRIMARY KEY,
                command_type TEXT NOT NULL,
                payload_hash TEXT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            """);

        var service = new EfIdempotencyService(dbContext);
        await service.AddAsync("legacy-key", "PlaceBetCommand");

        await Assert.ThrowsAsync<IdempotencyConflictException>(
            () => service.ExistsAsync(
                "legacy-key",
                "PlaceBetCommand",
                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"));
    }
}
