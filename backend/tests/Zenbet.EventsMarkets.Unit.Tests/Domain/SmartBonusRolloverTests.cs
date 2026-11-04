namespace Zenbet.EventsMarkets.Unit.Tests.Domain;

using Xunit;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class SmartBonusRolloverTests
{
    [Fact]
    public void PlaceBet_Uses_RealFirst_Then_BonusAvailable_And_Tracks_Locked_Balances()
    {
        var wallet = new Wallet(WalletId.New(), UserId.New());
        wallet.Deposit(new Money(80m), "Depósito inicial");
        wallet.GrantBonus(
            bonusAmount: new Money(50m),
            wageringRequirement: new Money(500m),
            minOdds: 1.50m,
            maxConversion: new Money(200m));

        var betTx = wallet.PlaceBet(
            amount: new Money(100m),
            selectionId: SelectionId.New(),
            description: "Apuesta mixta 80% Real / 20% Bono",
            acceptedOdds: 2.00m);

        Assert.Equal(new Money(0m), wallet.RealAvailable);
        Assert.Equal(new Money(30m), wallet.BonusAvailable);
        Assert.Equal(new Money(80m), wallet.RealLocked);
        Assert.Equal(new Money(20m), wallet.BonusLocked);
        Assert.Equal(new Money(30m), wallet.Balance);
        Assert.Equal(new Money(100m), wallet.AtRiskBalance);
        Assert.Equal(new Money(80m), betTx.RealStake);
        Assert.Equal(new Money(20m), betTx.BonusStake);
    }

    [Fact]
    public void SettleBet_Distributes_Winnings_Proportionally_Between_Real_And_Bonus()
    {
        var wallet = new Wallet(WalletId.New(), UserId.New());
        wallet.Deposit(new Money(80m), "Depósito inicial");
        wallet.GrantBonus(
            bonusAmount: new Money(50m),
            wageringRequirement: new Money(500m),
            minOdds: 1.50m,
            maxConversion: new Money(200m));

        // Apuesta de $100 (80% Real = $80, 20% Bono = $20) a cuota 2.00
        var betTx = wallet.PlaceBet(
            amount: new Money(100m),
            selectionId: SelectionId.New(),
            description: "Apuesta mixta",
            acceptedOdds: 2.00m);

        // Ganancia bruta = $200 -> 80% Real ($160) y 20% Bono ($40)
        var settlementTx = wallet.SettleBet(
            betTx,
            payoutAmount: new Money(200m),
            result: SettlementResult.Won,
            description: "Liquidación proporcional");

        Assert.Equal(new Money(0m), wallet.RealLocked);
        Assert.Equal(new Money(0m), wallet.BonusLocked);
        Assert.Equal(new Money(160m), wallet.RealAvailable);
        Assert.Equal(new Money(70m), wallet.BonusAvailable); // $30 restantes + $40 ganados
        Assert.Equal(new Money(230m), wallet.Balance);
        Assert.Equal(new Money(160m), settlementTx.RealStake);
        Assert.Equal(new Money(40m), settlementTx.BonusStake);
    }

    [Fact]
    public void PlaceBet_Below_MinOdds_Does_Not_Increment_Rollover_WageredAmount()
    {
        var wallet = new Wallet(WalletId.New(), UserId.New());
        wallet.Deposit(new Money(100m), "Depósito inicial");
        wallet.GrantBonus(
            bonusAmount: new Money(50m),
            wageringRequirement: new Money(200m),
            minOdds: 1.50m,
            maxConversion: new Money(100m));

        // Cuota 1.25 < MinOdds (1.50): no debe sumar al WageredAmount
        wallet.PlaceBet(
            amount: new Money(50m),
            selectionId: SelectionId.New(),
            description: "Apuesta cuota baja",
            acceptedOdds: 1.25m);

        Assert.NotNull(wallet.ActiveBonus);
        Assert.Equal(new Money(0m), wallet.ActiveBonus!.WageredAmount);
        Assert.False(wallet.ActiveBonus.IsCompleted);

        // Cuota 1.50 >= MinOdds (1.50): sí suma al WageredAmount
        wallet.PlaceBet(
            amount: new Money(50m),
            selectionId: SelectionId.New(),
            description: "Apuesta cuota válida",
            acceptedOdds: 1.50m);

        Assert.Equal(new Money(50m), wallet.ActiveBonus.WageredAmount);
        Assert.Equal(25m, wallet.ActiveBonus.ProgressPercentage);
    }

    [Fact]
    public void Rollover_Completion_Converts_BonusAvailable_To_RealAvailable_Capped_At_MaxConversion()
    {
        var wallet = new Wallet(WalletId.New(), UserId.New());
        wallet.Deposit(new Money(100m), "Depósito real");
        wallet.GrantBonus(
            bonusAmount: new Money(100m),
            wageringRequirement: new Money(200m),
            minOdds: 1.50m,
            maxConversion: new Money(150m));

        // 1ra apuesta: $100 (100% Real) a cuota 3.00 -> WageredAmount = $100 / $200
        var bet1 = wallet.PlaceBet(
            amount: new Money(100m),
            selectionId: SelectionId.New(),
            description: "Apuesta 1",
            acceptedOdds: 3.00m);
        wallet.SettleBet(bet1, new Money(300m), SettlementResult.Won);

        // Sumamos una ganancia de bono previa para superar el tope MaxConversion ($150)
        wallet.AddBonus(new Money(100m), "Ganancia adicional de bono");
        Assert.Equal(new Money(200m), wallet.BonusAvailable);

        // 2da apuesta: $100 a cuota 1.80 -> WageredAmount llega a $200 / $200 (100% Rollover)
        wallet.PlaceBet(
            amount: new Money(100m),
            selectionId: SelectionId.New(),
            description: "Apuesta 2 completa rollover",
            acceptedOdds: 1.80m);

        Assert.NotNull(wallet.ActiveBonus);
        Assert.True(wallet.ActiveBonus!.IsRolloverMet);
        Assert.True(wallet.ActiveBonus.IsCompleted);
        Assert.Equal(new Money(150m), wallet.ActiveBonus.ConvertedAmount);

        // Tenía $300 Real - $100 apostados = $200 Real + $150 convertidos por tope MaxConversion = $350 RealAvailable
        // Los $50 excedentes de BonusAvailable sobre MaxConversion ($200 - $150) se descartan
        Assert.Equal(new Money(350m), wallet.RealAvailable);
        Assert.Equal(new Money(0m), wallet.BonusAvailable);
        Assert.Contains(wallet.DomainEvents, e => e is BonusRolloverCompletedDomainEvent);
    }

    [Fact]
    public void RgsSeamlessWallet_Bet_Win_And_TombstoneRollback_Enforce_Proportional_And_AntiAbuse_Rules()
    {
        var wallet = new Wallet(WalletId.New(), UserId.New());
        wallet.Deposit(new Money(80m), "Depósito real");
        wallet.GrantBonus(
            bonusAmount: new Money(50m),
            wageringRequirement: new Money(500m),
            minOdds: 1.50m,
            maxConversion: new Money(200m));

        // 1. RGS Bet de $100 (Real-First: $80 Real + $20 Bono)
        var rgsBet = wallet.PlaceRgsBet(
            amount: new Money(100m),
            providerTransactionId: "PRAG-BET-001",
            gameId: "gates-of-olympus",
            roundId: "ROUND-100");

        Assert.Equal(new Money(0m), wallet.RealAvailable);
        Assert.Equal(new Money(30m), wallet.BonusAvailable);
        Assert.Equal(new Money(80m), rgsBet.RealStake);
        Assert.Equal(new Money(20m), rgsBet.BonusStake);

        // 2. RGS Win de $250 sobre la apuesta mixta (80% Real = $200, 20% Bono = $50)
        var rgsWin = wallet.CreditRgsWin(
            winAmount: new Money(250m),
            providerTransactionId: "PRAG-WIN-001",
            originalBetTransaction: rgsBet,
            gameId: "gates-of-olympus",
            roundId: "ROUND-100");

        Assert.Equal(new Money(200m), wallet.RealAvailable);
        Assert.Equal(new Money(80m), wallet.BonusAvailable); // $30 + $50
        Assert.Equal(new Money(200m), rgsWin.RealStake);
        Assert.Equal(new Money(50m), rgsWin.BonusStake);

        // 3. Tombstone Rollback cuando la apuesta nunca llegó por timeout
        var tombstone = wallet.RollbackRgsBet(
            providerTransactionId: "PRAG-TIMEOUT-999",
            existingBetTransaction: null,
            roundId: "ROUND-101");

        Assert.Equal(TransactionType.BetCancellation, tombstone.Type);
        Assert.Equal(TransactionStatus.Cancelled, tombstone.Status);
        Assert.Equal(new Money(0m), tombstone.Amount);
        Assert.Equal(new Money(280m), wallet.Balance);
    }

    [Fact]
    public void ClawbackSettlement_When_Player_Withdrew_Winnings_Puts_RealAvailable_Into_Negative_Debt_And_Links_ReferenceTransactionId()
    {
        var wallet = new Wallet(WalletId.New(), UserId.New());
        wallet.Deposit(new Money(100m), "Depósito inicial");

        var betTx = wallet.PlaceBet(
            amount: new Money(100m),
            selectionId: SelectionId.New(),
            description: "Apuesta antes de VAR",
            acceptedOdds: 2.50m);

        var settlementTx = wallet.SettleBet(
            betTx,
            payoutAmount: new Money(250m),
            result: SettlementResult.Won,
            description: "Pago inicial pre-VAR");

        // El jugador retira $200 de los $250 ganados -> le quedan $50 en RealAvailable
        wallet.Withdraw(new Money(200m), "Retiro rápido");
        Assert.Equal(new Money(50m), wallet.RealAvailable);

        // El VAR anula la victoria ($250): $50 - $250 = -$200.00 (Deuda en RealAvailable)
        var clawbackTx = wallet.ClawbackSettlement(settlementTx.Id, "Decisión VAR: Gol anulado");

        Assert.True(wallet.RealAvailable.IsNegative);
        Assert.Equal(-200m, wallet.RealAvailable.Amount);
        Assert.Equal(TransactionType.Clawback, clawbackTx.Type);
        Assert.Equal(settlementTx.Id, clawbackTx.ReferenceTransactionId);
        Assert.Equal(TransactionStatus.ClawedBack, settlementTx.Status);
    }

    [Fact]
    public void ClawbackSettlement_Reverts_ActiveBonus_WageredAmount_And_Undoes_Rollover_Conversion()
    {
        var wallet = new Wallet(WalletId.New(), UserId.New());
        wallet.Deposit(new Money(100m), "Depósito real");
        wallet.GrantBonus(
            bonusAmount: new Money(100m),
            wageringRequirement: new Money(100m),
            minOdds: 1.50m,
            maxConversion: new Money(100m));

        // Apuesta de $100 Real a cuota 2.00 cumple el 100% del rollover ($100/$100)
        // y convierte los $100 de BonusAvailable a RealAvailable
        var betTx = wallet.PlaceBet(
            amount: new Money(100m),
            selectionId: SelectionId.New(),
            description: "Apuesta que completa rollover",
            acceptedOdds: 2.00m);

        Assert.True(wallet.ActiveBonus!.IsCompleted);
        Assert.Equal(new Money(100m), wallet.RealAvailable);
        Assert.Equal(new Money(0m), wallet.BonusAvailable);

        var settlementTx = wallet.SettleBet(
            betTx,
            payoutAmount: new Money(200m),
            result: SettlementResult.Won);

        Assert.Equal(new Money(300m), wallet.RealAvailable);

        // Clawback revierte el pago ($200) Y deshace la conversión del bono ($100 vuelve a BonusAvailable)
        var clawbackTx = wallet.ClawbackSettlement(settlementTx.Id, "Descalificación oficial");

        Assert.False(wallet.ActiveBonus.IsCompleted);
        Assert.Equal(new Money(0m), wallet.ActiveBonus.WageredAmount);
        Assert.Equal(new Money(0m), wallet.ActiveBonus.ConvertedAmount);
        Assert.Equal(new Money(100m), wallet.BonusAvailable);
        Assert.Equal(new Money(0m), wallet.RealAvailable);
        Assert.Equal(settlementTx.Id, clawbackTx.ReferenceTransactionId);
    }
}

