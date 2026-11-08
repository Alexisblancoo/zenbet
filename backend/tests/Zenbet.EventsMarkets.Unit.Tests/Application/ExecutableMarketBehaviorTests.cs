namespace Zenbet.EventsMarkets.Unit.Tests.Application;

using MediatR;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;
using Zenbet.EventsMarkets.Application.Behaviors;
using Zenbet.EventsMarkets.Application.Commands.PlaceBet;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class ExecutableMarketBehaviorTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 8, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task A_Bet_On_A_Reference_Line_Is_Rejected_Before_Any_Transaction_Opens()
    {
        var (command, repository) = Scenario(new MarketProvenance("ZenBet Reference", OddsSourceKind.Model, null, Now));
        var behavior = CreateBehavior(repository, allowReferenceLines: false);
        var nextCalled = false;

        var result = await behavior.Handle(command, () => { nextCalled = true; return Task.FromResult(Ok()); }, CancellationToken.None);

        Assert.False(nextCalled);
        Assert.False(result.Success);
        Assert.Equal(ExecutableMarketBehavior<PlaceBetCommand, PlaceBetResult>.ErrorCode, result.ErrorCode);
        Assert.Equal("REFERENCE_LINE_NOT_BETTABLE", result.ErrorCode);
    }

    [Fact]
    public async Task Reference_Lines_Can_Be_Enabled_Explicitly_For_Local_Demos()
    {
        var (command, repository) = Scenario(new MarketProvenance("ZenBet Reference", OddsSourceKind.Model, null, Now));
        var behavior = CreateBehavior(repository, allowReferenceLines: true);

        var result = await behavior.Handle(command, () => Task.FromResult(Ok()), CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(0, repository.Lookups);
    }

    [Fact]
    public async Task A_Market_Priced_By_The_Operator_Accepts_Bets()
    {
        var (command, repository) = Scenario(new MarketProvenance("ZenBet Trading", OddsSourceKind.Operator, null, Now));
        var behavior = CreateBehavior(repository, allowReferenceLines: false);

        var result = await behavior.Handle(command, () => Task.FromResult(Ok()), CancellationToken.None);

        Assert.True(result.Success);
    }

    [Fact]
    public async Task A_Market_Without_Provenance_Is_Operator_Managed_And_Accepts_Bets()
    {
        var (command, repository) = Scenario(provenance: null);
        var behavior = CreateBehavior(repository, allowReferenceLines: false);

        var result = await behavior.Handle(command, () => Task.FromResult(Ok()), CancellationToken.None);

        Assert.True(result.Success);
    }

    [Fact]
    public async Task An_Unknown_Selection_Falls_Through_To_The_Normal_Handler_Error()
    {
        var (command, _) = Scenario(provenance: null);
        var behavior = CreateBehavior(new FakeMarketRepository(null), allowReferenceLines: false);

        var result = await behavior.Handle(command, () => Task.FromResult(Ok()), CancellationToken.None);

        Assert.True(result.Success);
    }

    [Fact]
    public async Task Requests_That_Are_Not_Bets_Pass_Through_Without_Touching_The_Repository()
    {
        var repository = new FakeMarketRepository(null);
        var behavior = new ExecutableMarketBehavior<Ping, string>(
            repository,
            Options.Create(new BettingOptions()),
            NullLogger<ExecutableMarketBehavior<Ping, string>>.Instance);

        var result = await behavior.Handle(new Ping(), () => Task.FromResult("pong"), CancellationToken.None);

        Assert.Equal("pong", result);
        Assert.Equal(0, repository.Lookups);
    }

    private static PlaceBetResult Ok() => new(
        true,
        Zenbet.EventsMarkets.Application.Commands.PlaceBet.BetId.New(),
        TransactionId.New(),
        Money.Zero,
        null);

    private static ExecutableMarketBehavior<PlaceBetCommand, PlaceBetResult> CreateBehavior(
        FakeMarketRepository repository,
        bool allowReferenceLines) =>
        new(
            repository,
            Options.Create(new BettingOptions { AllowReferenceLines = allowReferenceLines }),
            NullLogger<ExecutableMarketBehavior<PlaceBetCommand, PlaceBetResult>>.Instance);

    private static (PlaceBetCommand Command, FakeMarketRepository Repository) Scenario(MarketProvenance? provenance)
    {
        var selection = new Selection(SelectionId.New(), "Fighter A", new Odd(2.0m, Now));
        var market = new Market(
            MarketId.New(),
            EventId.New(),
            "Winner",
            MarketType.Moneyline,
            new[] { selection },
            provenance: provenance);

        var command = new PlaceBetCommand(WalletId.New(), selection.Id, new Money(10m), "test", Guid.NewGuid());
        return (command, new FakeMarketRepository(market));
    }

    public sealed record Ping : IRequest<string>;

    private sealed class FakeMarketRepository : IMarketRepository
    {
        private readonly Market? _market;

        public FakeMarketRepository(Market? market) => _market = market;

        public int Lookups { get; private set; }

        public Task<Market?> GetBySelectionIdAsync(SelectionId selectionId, CancellationToken cancellationToken = default)
        {
            Lookups++;
            return Task.FromResult(_market);
        }

        public Task<Market?> GetByIdAsync(MarketId id, CancellationToken cancellationToken = default)
            => Task.FromResult(_market);

        public Task<Market?> GetByIdWithSelectionsAsync(MarketId id, CancellationToken cancellationToken = default)
            => Task.FromResult(_market);

        public Task AddAsync(Market market, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task UpdateAsync(Market market, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<IReadOnlyList<Market>> GetByEventIdAsync(EventId eventId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Market>>([]);

        public Task<IReadOnlyList<Market>> GetOpenMarketsByEventIdAsync(EventId eventId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Market>>([]);
    }
}
