namespace Zenbet.EventsMarkets.Unit.Tests.Domain;

using Xunit;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class CashOutTests
{
    [Fact]
    public void CashOut_Releases_Locked_Stakes_And_Credits_Value_To_RealAvailable()
    {
        var wallet = new Wallet(WalletId.New(), UserId.New());
        wallet.Deposit(new Money(80m), "Depósito inicial");
        wallet.GrantBonus(
            bonusAmount: new Money(50m),
            wageringRequirement: new Money(500m),
            minOdds: 1.50m,
            maxConversion: new Money(200m));

        // Apuesta mixta de $100: $80 Real + $20 Bono.
        var bet = wallet.PlaceBet(
            amount: new Money(100m),
            selectionId: SelectionId.New(),
            description: "Apuesta a liquidar anticipadamente",
            acceptedOdds: 2.00m);

        wallet.ClearDomainEvents();

        var marketId = MarketId.New();
        var cashOutTransaction = wallet.CashOut(
            bet,
            new Money(135m),
            marketId,
            initialOdds: 2.00m,
            currentOdds: 3.00m,
            retentionMargin: 0.90m);

        // El stake deja de estar en riesgo y el valor ya neto pasa a saldo real.
        Assert.Equal(Money.Zero, wallet.RealLocked);
        Assert.Equal(Money.Zero, wallet.BonusLocked);
        Assert.Equal(new Money(135m), wallet.RealAvailable);
        Assert.Equal(new Money(30m), wallet.BonusAvailable);
        Assert.Equal(new Money(165m), wallet.Balance);
        Assert.Equal(Money.Zero, wallet.AtRiskBalance);

        // El boleto original queda cerrado y no puede volver a liquidarse.
        Assert.Equal(BetStatus.CashedOut, bet.BetStatus);
        Assert.Equal(TransactionStatus.Completed, bet.Status);

        // El ledger registra el movimiento CashOut, no una liquidación deportiva.
        Assert.Equal(TransactionType.CashOut, cashOutTransaction.Type);
        Assert.Equal(TransactionStatus.Completed, cashOutTransaction.Status);
        Assert.Equal(BetStatus.CashedOut, cashOutTransaction.BetStatus);
        Assert.Equal(new Money(135m), cashOutTransaction.Amount);
        Assert.Equal(new Money(165m), cashOutTransaction.BalanceAfter);
        Assert.Equal(bet.Id, cashOutTransaction.ReferenceTransactionId);
        Assert.Contains(wallet.Transactions, transaction => transaction.Type == TransactionType.CashOut);

        var domainEvent = Assert.Single(wallet.DomainEvents.OfType<BetCashedOutDomainEvent>());
        Assert.Equal(wallet.Id, domainEvent.WalletId);
        Assert.Equal(bet.Id, domainEvent.BetTransactionId);
        Assert.Equal(cashOutTransaction.Id, domainEvent.CashOutTransactionId);
        Assert.Equal(marketId, domainEvent.MarketId);
        Assert.Equal(new Money(100m), domainEvent.OriginalStake);
        Assert.Equal(new Money(135m), domainEvent.CashOutAmount);
        Assert.Equal(2.00m, domainEvent.InitialOdds);
        Assert.Equal(3.00m, domainEvent.CurrentOdds);
        Assert.Equal(0.90m, domainEvent.RetentionMargin);
        Assert.Equal(new Money(135m), domainEvent.NewRealAvailable);
    }

    [Fact]
    public void CashOut_Rejects_A_Bet_That_Is_No_Longer_Pending()
    {
        var wallet = new Wallet(WalletId.New(), UserId.New());
        wallet.Deposit(new Money(100m));

        var bet = wallet.PlaceBet(
            amount: new Money(50m),
            selectionId: SelectionId.New(),
            acceptedOdds: 2.00m);

        wallet.SettleBet(bet, new Money(100m), SettlementResult.Won);
        bet.SettleBet(BetStatus.Won);

        Assert.Throws<InvalidOperationException>(() => wallet.CashOut(
            bet,
            new Money(60m),
            MarketId.New(),
            initialOdds: 2.00m,
            currentOdds: 2.00m,
            retentionMargin: 0.90m));
    }

    [Fact]
    public void CashOut_Cannot_Be_Applied_Twice_To_The_Same_Bet()
    {
        var wallet = new Wallet(WalletId.New(), UserId.New());
        wallet.Deposit(new Money(100m));

        var bet = wallet.PlaceBet(
            amount: new Money(50m),
            selectionId: SelectionId.New(),
            acceptedOdds: 2.00m);

        var marketId = MarketId.New();
        wallet.CashOut(bet, new Money(60m), marketId, 2.00m, 2.50m, 0.90m);

        Assert.Throws<InvalidOperationException>(() => wallet.CashOut(
            bet,
            new Money(60m),
            marketId,
            initialOdds: 2.00m,
            currentOdds: 2.50m,
            retentionMargin: 0.90m));
    }

    [Fact]
    public void CashOut_Rejects_A_Bet_From_Another_Wallet()
    {
        var wallet = new Wallet(WalletId.New(), UserId.New());
        wallet.Deposit(new Money(100m));

        var otherWallet = new Wallet(WalletId.New(), UserId.New());
        otherWallet.Deposit(new Money(100m));
        var foreignBet = otherWallet.PlaceBet(
            amount: new Money(50m),
            selectionId: SelectionId.New(),
            acceptedOdds: 2.00m);

        Assert.Throws<InvalidOperationException>(() => wallet.CashOut(
            foreignBet,
            new Money(60m),
            MarketId.New(),
            initialOdds: 2.00m,
            currentOdds: 2.00m,
            retentionMargin: 0.90m));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-0.01)]
    [InlineData(1.01)]
    public void CashOut_Rejects_Retention_Margin_Outside_The_Unit_Interval(decimal retentionMargin)
    {
        var wallet = new Wallet(WalletId.New(), UserId.New());
        wallet.Deposit(new Money(100m));

        var bet = wallet.PlaceBet(
            amount: new Money(50m),
            selectionId: SelectionId.New(),
            acceptedOdds: 2.00m);

        Assert.Throws<InvalidTransactionAmountException>(() => wallet.CashOut(
            bet,
            new Money(60m),
            MarketId.New(),
            initialOdds: 2.00m,
            currentOdds: 2.00m,
            retentionMargin: retentionMargin));
    }

    [Fact]
    public void CashOut_Rejects_Invalid_Odds()
    {
        var wallet = new Wallet(WalletId.New(), UserId.New());
        wallet.Deposit(new Money(100m));

        var bet = wallet.PlaceBet(
            amount: new Money(50m),
            selectionId: SelectionId.New(),
            acceptedOdds: 2.00m);

        Assert.Throws<InvalidTransactionAmountException>(() => wallet.CashOut(
            bet,
            new Money(60m),
            MarketId.New(),
            initialOdds: 1.00m,
            currentOdds: 2.00m,
            retentionMargin: 0.90m));
    }
}
