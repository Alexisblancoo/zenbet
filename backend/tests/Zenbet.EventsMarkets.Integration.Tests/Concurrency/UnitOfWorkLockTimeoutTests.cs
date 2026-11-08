namespace Zenbet.EventsMarkets.Integration.Tests.Concurrency;

using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Services;

public sealed class UnitOfWorkLockTimeoutTests : IAsyncLifetime
{
    private const long LockKey = 424242;

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine")
        .WithDatabase("zenbet_test")
        .WithUsername("test")
        .WithPassword("test")
        .Build();

    public Task InitializeAsync() => _postgres.StartAsync();

    public async Task DisposeAsync() => await _postgres.DisposeAsync();

    [Fact]
    public async Task Waiting_For_A_Held_Advisory_Lock_Fails_Fast_And_Rollback_Does_Not_Mask_It()
    {
        await using var holder = new NpgsqlConnection(_postgres.GetConnectionString());
        await holder.OpenAsync();
        await using var holderTransaction = await holder.BeginTransactionAsync();
        await using (var hold = new NpgsqlCommand($"SELECT pg_advisory_xact_lock({LockKey});", holder, holderTransaction))
        {
            await hold.ExecuteNonQueryAsync();
        }

        await using var dbContext = CreateDbContext();
        var unitOfWork = new EfUnitOfWork(dbContext);
        await unitOfWork.BeginTransactionAsync();

        var stopwatch = Stopwatch.StartNew();
        var exception = await Assert.ThrowsAnyAsync<Exception>(
            () => unitOfWork.TryAcquireAdvisoryLockAsync(LockKey));
        stopwatch.Stop();

        var postgresException = exception as PostgresException ?? exception.InnerException as PostgresException;
        Assert.NotNull(postgresException);
        Assert.Equal("55P03", postgresException!.SqlState);

        // lock_timeout = 3 s: ni inmediato (no se esperó) ni colgado hasta el timeout del comando (30 s).
        Assert.InRange(stopwatch.Elapsed, TimeSpan.FromSeconds(2.5), TimeSpan.FromSeconds(10));

        // El rollback tras el fallo no debe lanzar ni enmascarar el error original.
        await unitOfWork.RollbackAsync();

        // Con el lock liberado, la misma operación funciona.
        await holderTransaction.CommitAsync();
        await using var secondContext = CreateDbContext();
        var secondUnitOfWork = new EfUnitOfWork(secondContext);
        await secondUnitOfWork.BeginTransactionAsync();
        Assert.True(await secondUnitOfWork.TryAcquireAdvisoryLockAsync(LockKey));
        await secondUnitOfWork.CommitAsync();
    }

    private EventsMarketsDbContext CreateDbContext() =>
        new(new DbContextOptionsBuilder<EventsMarketsDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options);
}
