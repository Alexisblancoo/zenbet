namespace Zenbet.EventsMarkets.Integration.Tests.Benchmarking;

using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Testcontainers.PostgreSql;
using Xunit;
using Xunit.Abstractions;
using MediatR;
using Zenbet.EventsMarkets.Application.Behaviors;
using Zenbet.EventsMarkets.Application.Commands.PlaceBet;
using Zenbet.EventsMarkets.Application.Commands.UpdateOdds;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Infrastructure.Persistence;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Outbox;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Repositories;
using Zenbet.EventsMarkets.Infrastructure.Persistence.Services;
using DomainEventId = Zenbet.EventsMarkets.Domain.ValueObjects.EventId;

public sealed class MassiveConcurrencyBenchmarkTests : IAsyncLifetime
{
    private readonly ITestOutputHelper _output;
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine")
        .WithDatabase("zenbet_benchmark")
        .WithUsername("test")
        .WithPassword("test")
        .Build();

    private ServiceProvider _serviceProvider = null!;
    private EventsMarketsDbContext _dbContext = null!;

    public MassiveConcurrencyBenchmarkTests(ITestOutputHelper output)
    {
        _output = output;
    }

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        var services = new ServiceCollection();
        services.AddLogging(b => b.AddConsole().SetMinimumLevel(LogLevel.Warning));

        services.AddDbContext<EventsMarketsDbContext>(options =>
            options.UseNpgsql(_postgres.GetConnectionString()));

        services.AddScoped<IEventRepository, EventRepository>();
        services.AddScoped<IMarketRepository, MarketRepository>();
        services.AddScoped<ISelectionRepository, SelectionRepository>();
        services.AddScoped<IWalletRepository, WalletRepository>();
        services.AddScoped<ITransactionRepository, TransactionRepository>();
        services.AddScoped<IOutboxWriter, OutboxWriter>();
        services.AddScoped<IInboxWriter, InboxWriter>();
        services.AddScoped<IUnitOfWork, EfUnitOfWork>();
        services.AddScoped<IIdempotencyService, EfIdempotencyService>();
        services.AddScoped<ISettlementAuditService, EfSettlementAuditService>();
        services.AddScoped<IRiskManagementService, EfRiskManagementService>();

        services.Configure<RiskLimitsOptions>(o =>
        {
            o.MaxUserBetLimit = new Money(1000m);
            o.MaxMarketExposureLimit = new Money(50000m);
        });

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(typeof(PlaceBetCommandHandler).Assembly);
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(RiskValidationBehavior<,>));
        });

        _serviceProvider = services.BuildServiceProvider();
        _dbContext = _serviceProvider.GetRequiredService<EventsMarketsDbContext>();

        await _dbContext.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await _serviceProvider.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task Benchmark_500_Mixed_Concurrent_Requests_With_Percentile_Latencies_Enforces_Exposure_And_Balance()
    {
        // 1. Arrange: Sembrado de 20 billeteras con 10,000 EUR cada una (total 200,000 EUR)
        const int walletCount = 20;
        const decimal initialWalletBalance = 10_000m;
        var wallets = new List<WalletId>();

        for (var i = 0; i < walletCount; i++)
        {
            var wid = WalletId.New();
            var wallet = new Wallet(wid, UserId.New());
            wallet.Deposit(new Money(initialWalletBalance), $"Seed wallet {i}");
            _dbContext.Wallets.Add(wallet);
            wallets.Add(wid);
        }

        // Sembrado del Evento deportivo con 2 selecciones (Home y Away)
        var eventId = DomainEventId.New();
        var selectionHomeId = SelectionId.New();
        var selectionAwayId = SelectionId.New();

        var @event = new Event(eventId, "UFC 312: Makhachev vs Tsarukyan 2", SportType.MixedMartialArts, DateTimeOffset.UtcNow.AddHours(4));
        var selections = new List<Selection>
        {
            new(selectionHomeId, "Islam Makhachev", new Odd(1.85m, DateTimeOffset.UtcNow)),
            new(selectionAwayId, "Arman Tsarukyan", new Odd(2.10m, DateTimeOffset.UtcNow))
        };
        var market = @event.AddMarket("Moneyline", MarketType.MmaMoneyline, selections);

        _dbContext.Events.Add(@event);
        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();

        // 2. Preparar 500 solicitudes mixtas concurrentes (400 apuestas + 100 actualizaciones de cuotas)
        const int totalBets = 400;
        const int totalOddsUpdates = 100;
        const int totalRequests = totalBets + totalOddsUpdates;

        var operations = new List<Func<Task<OperationMetric>>>(totalRequests);

        // Generar 400 apuestas distribuidas en los 20 wallets
        for (var i = 0; i < totalBets; i++)
        {
            var walletId = wallets[i % walletCount];
            var selectionId = i % 2 == 0 ? selectionHomeId : selectionAwayId;
            var expectedOdds = i % 2 == 0 ? 1.85m : 2.10m;
            var betAmount = new Money(50m + (i % 5) * 20m); // Entre 50 y 130 EUR

            var command = new PlaceBetCommand(
                walletId,
                selectionId,
                betAmount,
                $"Stress-Bet-{i}",
                Guid.NewGuid(),
                ExpectedOdds: expectedOdds,
                MaxSlippagePercent: 15.0m
            );

            operations.Add(async () =>
            {
                var sw = Stopwatch.StartNew();
                using var scope = _serviceProvider.CreateScope();
                var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
                try
                {
                    var result = await mediator.Send(command);
                    sw.Stop();
                    return new OperationMetric("PlaceBet", sw.Elapsed.TotalMilliseconds, result.Success, result.ErrorCode);
                }
                catch (Exception ex)
                {
                    sw.Stop();
                    return new OperationMetric("PlaceBet", sw.Elapsed.TotalMilliseconds, false, ex.GetType().Name);
                }
            });
        }

        // Generar 100 actualizaciones de cuotas concurrentes simulando feed externo en vivo
        for (var i = 0; i < totalOddsUpdates; i++)
        {
            var selectionId = i % 2 == 0 ? selectionHomeId : selectionAwayId;
            var baseOdds = i % 2 == 0 ? 1.85m : 2.10m;
            var variance = ((i % 10) - 5) * 0.01m; // Pequeña fluctuación +/- 0.05
            var newOdds = Math.Max(1.10m, Math.Round(baseOdds + variance, 2));

            var updateCommand = new UpdateOddsCommand(
                new[] { new OddsUpdateItem(selectionId, newOdds, DateTimeOffset.UtcNow, "StressFeed") },
                Guid.NewGuid()
            );

            operations.Add(async () =>
            {
                var sw = Stopwatch.StartNew();
                using var scope = _serviceProvider.CreateScope();
                var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
                try
                {
                    var result = await mediator.Send(updateCommand);
                    sw.Stop();
                    return new OperationMetric("UpdateOdds", sw.Elapsed.TotalMilliseconds, result.ProcessedCount > 0, null);
                }
                catch (Exception ex)
                {
                    sw.Stop();
                    return new OperationMetric("UpdateOdds", sw.Elapsed.TotalMilliseconds, false, ex.GetType().Name);
                }
            });
        }

        // Mezclar aleatoriamente las operaciones para intercalar bets y odds updates
        var random = new Random(42);
        var shuffledOps = operations.OrderBy(_ => random.Next()).ToList();

        // 3. Act: Ejecutar las 500 solicitudes de forma altamente concurrente
        _output.WriteLine($"[BENCHMARK] Disparando {shuffledOps.Count} solicitudes concurrentes (400 bets + 100 odds updates)...");
        var overallSw = Stopwatch.StartNew();

        var metricTasks = shuffledOps.Select(op => Task.Run(op)).ToArray();
        var metrics = await Task.WhenAll(metricTasks);

        overallSw.Stop();
        var totalElapsedMs = overallSw.Elapsed.TotalMilliseconds;

        // 4. Analizar latencias en percentiles (p50, p90, p95, p99)
        var latencies = metrics.Select(m => m.ElapsedMs).OrderBy(t => t).ToList();
        var minLatency = latencies.First();
        var maxLatency = latencies.Last();
        var avgLatency = latencies.Average();
        var p50 = GetPercentile(latencies, 0.50);
        var p90 = GetPercentile(latencies, 0.90);
        var p95 = GetPercentile(latencies, 0.95);
        var p99 = GetPercentile(latencies, 0.99);

        var throughput = (totalRequests / (totalElapsedMs / 1000.0));

        _output.WriteLine($"================================================================================");
        _output.WriteLine($"[BENCHMARK RESULTS] Massive Concurrency & Risk Limits Stress Test");
        _output.WriteLine($"================================================================================");
        _output.WriteLine($"Total Solicitudes:    {totalRequests} (400 Bets, 100 Odds Updates)");
        _output.WriteLine($"Tiempo Total:         {totalElapsedMs:F2} ms");
        _output.WriteLine($"Rendimiento (TPS):    {throughput:F2} req/sec");
        _output.WriteLine($"Latencia Mínima:      {minLatency:F2} ms");
        _output.WriteLine($"Latencia Media (Avg): {avgLatency:F2} ms");
        _output.WriteLine($"Latencia p50:         {p50:F2} ms");
        _output.WriteLine($"Latencia p90:         {p90:F2} ms");
        _output.WriteLine($"Latencia p95:         {p95:F2} ms");
        _output.WriteLine($"Latencia p99:         {p99:F2} ms");
        _output.WriteLine($"Latencia Máxima:      {maxLatency:F2} ms");
        _output.WriteLine($"================================================================================");

        var betMetrics = metrics.Where(m => m.OperationType == "PlaceBet").ToList();
        var successfulBets = betMetrics.Count(m => m.Success);
        var failedBets = betMetrics.Count(m => !m.Success);
        var exposureExceededCount = betMetrics.Count(m => m.ErrorCode == "EXPOSURE_LIMIT_EXCEEDED");
        var oddsChangedCount = betMetrics.Count(m => m.ErrorCode == "ODDS_CHANGED");

        _output.WriteLine($"Apuestas Aceptadas:   {successfulBets}");
        _output.WriteLine($"Apuestas Rechazadas:  {failedBets}");
        _output.WriteLine($"  - Por Exposición:   {exposureExceededCount}");
        _output.WriteLine($"  - Por Slippage:     {oddsChangedCount}");
        _output.WriteLine($"================================================================================");

        // 5. Verificaciones de Invariantes Financieras e Integridad
        // A. Cero deadlocks: las 500 solicitudes concluyeron
        Assert.Equal(500, metrics.Length);

        // B. Conservación de fondos en billeteras
        using var verifyScope = _serviceProvider.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<EventsMarketsDbContext>();

        var allWallets = await verifyDb.Wallets.AsNoTracking().Where(w => wallets.Contains(w.Id)).ToListAsync();
        var allTransactions = await verifyDb.Transactions.AsNoTracking().Where(t => t.Type == TransactionType.BetPlacement).ToListAsync();

        Assert.Equal(successfulBets, allTransactions.Count);

        foreach (var wallet in allWallets)
        {
            var walletTransactions = allTransactions.Where(t => t.WalletId == wallet.Id).ToList();
            var totalSpent = walletTransactions.Sum(t => t.Amount.Amount);
            var expectedBalance = initialWalletBalance - totalSpent;

            Assert.Equal(expectedBalance, wallet.Balance.Amount);
            Assert.True(wallet.Balance.Amount >= 0, $"La billetera {wallet.Id} presentó sobregiro: {wallet.Balance.Amount}");
        }

        // C. Garantía de Outbox: Cada apuesta aceptada debe haber registrado su evento en la tabla de Outbox
        var outboxMessages = await verifyDb.OutboxMessages.AsNoTracking().CountAsync();
        Assert.Equal(successfulBets, outboxMessages);

        // D. Límite de exposición de riesgo: el pasivo total de la casa nunca superó 50,000 EUR
        var homeSelection = await verifyDb.Selections.SingleAsync(s => s.Id == selectionHomeId);
        var awaySelection = await verifyDb.Selections.SingleAsync(s => s.Id == selectionAwayId);

        var homeBetsLiability = allTransactions.Where(t => t.SelectionId == selectionHomeId).Sum(t => t.Amount.Amount * homeSelection.CurrentOdd.Value);
        var awayBetsLiability = allTransactions.Where(t => t.SelectionId == selectionAwayId).Sum(t => t.Amount.Amount * awaySelection.CurrentOdd.Value);
        var totalMarketExposure = homeBetsLiability + awayBetsLiability;

        Assert.True(totalMarketExposure <= 50000m,
            $"El pasivo del mercado superó el límite de exposición: Actual={totalMarketExposure}, Límite=50000");
    }

    private static double GetPercentile(List<double> sortedList, double percentile)
    {
        if (sortedList.Count == 0) return 0;
        var index = (int)Math.Ceiling(percentile * sortedList.Count) - 1;
        index = Math.Clamp(index, 0, sortedList.Count - 1);
        return sortedList[index];
    }

    private sealed record OperationMetric(string OperationType, double ElapsedMs, bool Success, string? ErrorCode);
}

