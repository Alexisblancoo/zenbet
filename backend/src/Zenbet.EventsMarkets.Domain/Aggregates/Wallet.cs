namespace Zenbet.EventsMarkets.Domain.Aggregates;

using System.Diagnostics.CodeAnalysis;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using Zenbet.EventsMarkets.Domain.Common;

public sealed class Wallet : AggregateRoot<WalletId>
{
    private readonly List<Transaction> _transactions = new();

    private Wallet() { } // EF Core

    [SetsRequiredMembers]
    public Wallet(WalletId id, UserId userId)
        : base(id)
    {
        UserId = userId;
        RealAvailable = Money.Zero;
        BonusAvailable = Money.Zero;
        RealLocked = Money.Zero;
        BonusLocked = Money.Zero;
        Balance = Money.Zero;
        AtRiskBalance = Money.Zero;
        Version = 0;
    }

    public required UserId UserId { get; init; }
    public Money RealAvailable { get; private set; }
    public Money BonusAvailable { get; private set; }
    public Money RealLocked { get; private set; }
    public Money BonusLocked { get; private set; }
    public Money Balance { get; private set; }
    public Money AtRiskBalance { get; private set; }
    public ActiveBonus? ActiveBonus { get; private set; }
    public uint Version { get; private set; }
    public IReadOnlyCollection<Transaction> Transactions => _transactions.AsReadOnly();

    private void EnsureSplitBalancesInitialized()
    {
        if (RealAvailable == Money.Zero && BonusAvailable == Money.Zero && Balance > Money.Zero)
        {
            RealAvailable = Balance;
        }

        if (RealLocked == Money.Zero && BonusLocked == Money.Zero && AtRiskBalance > Money.Zero)
        {
            RealLocked = AtRiskBalance;
        }
    }

    private void SyncBalances()
    {
        Balance = Money.Signed(RealAvailable.Amount + BonusAvailable.Amount);
        AtRiskBalance = RealLocked + BonusLocked;
    }

    public Transaction Deposit(Money amount, string? description = null, string? referenceId = null)
    {
        if (amount <= Money.Zero)
            throw new InvalidTransactionAmountException("Deposit amount must be positive");

        EnsureSplitBalancesInitialized();

        RealAvailable = Money.Signed(RealAvailable.Amount + amount.Amount);
        SyncBalances();

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            UserId,
            TransactionType.Deposit,
            amount,
            Balance,
            description,
            referenceId);

        _transactions.Add(transaction);
        Version++;

        AddDomainEvent(new WalletDepositedDomainEvent(Id, UserId, amount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public void CreditDeposit(Transaction transaction)
    {
        ArgumentNullException.ThrowIfNull(transaction);

        if (transaction.WalletId != Id)
            throw new InvalidOperationException("La transacción no pertenece a esta billetera.");

        if (transaction.UserId != UserId)
            throw new InvalidOperationException("El usuario de la transacción no coincide con la billetera.");

        if (transaction.Type != TransactionType.Deposit)
            throw new InvalidOperationException("Solo un depósito puede acreditarse.");

        if (transaction.Status != TransactionStatus.Pending)
            throw new InvalidOperationException($"No se puede acreditar una transacción en estado {transaction.Status}.");

        EnsureSplitBalancesInitialized();

        RealAvailable = Money.Signed(RealAvailable.Amount + transaction.Amount.Amount);
        SyncBalances();

        transaction.Approve(Balance);
        Version++;

        AddDomainEvent(new WalletDepositedDomainEvent(Id, UserId, transaction.Amount, Balance, transaction.Id, DateTimeOffset.UtcNow));
    }

    public Transaction Withdraw(Money amount, string? description = null, string? referenceId = null)
    {
        if (amount <= Money.Zero)
            throw new InvalidTransactionAmountException("Withdrawal amount must be positive");

        EnsureSplitBalancesInitialized();

        if (RealAvailable < amount)
            throw new InsufficientFundsException(Id, amount, RealAvailable);

        RealAvailable -= amount;
        SyncBalances();

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            UserId,
            TransactionType.Withdrawal,
            amount,
            Balance,
            description,
            referenceId);

        _transactions.Add(transaction);
        Version++;

        AddDomainEvent(new WalletWithdrawnDomainEvent(Id, UserId, amount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public Transaction Withdraw(
        Money amount,
        KycStatus userKycStatus,
        string? description = null,
        string? referenceId = null)
    {
        if (userKycStatus != KycStatus.Verified)
            throw new KycVerificationRequiredException(UserId, userKycStatus);

        return Withdraw(amount, description, referenceId);
    }

    public Transaction GrantBonus(
        Money bonusAmount,
        Money wageringRequirement,
        decimal minOdds,
        Money maxConversion,
        string? description = null,
        string? referenceId = null)
    {
        if (bonusAmount <= Money.Zero)
            throw new InvalidTransactionAmountException("Bonus amount must be positive");

        if (wageringRequirement <= Money.Zero)
            throw new InvalidTransactionAmountException("Wagering requirement must be positive");

        if (minOdds <= 1m)
            throw new InvalidTransactionAmountException("Minimum odds for bonus rollover must be greater than 1.00");

        if (maxConversion <= Money.Zero)
            throw new InvalidTransactionAmountException("Max conversion cap must be positive");

        EnsureSplitBalancesInitialized();

        if (ActiveBonus is { IsCompleted: false } && (BonusAvailable > Money.Zero || BonusLocked > Money.Zero))
            throw new InvalidOperationException("La billetera ya posee un bono activo en curso.");

        ActiveBonus = new ActiveBonus(
            BonusId.New(),
            bonusAmount,
            wageringRequirement,
            minOdds,
            maxConversion);

        BonusAvailable += bonusAmount;
        SyncBalances();

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            UserId,
            TransactionType.Bonus,
            bonusAmount,
            Balance,
            description ?? $"Smart Bonus granted (Rollover: {wageringRequirement}, MinOdds: {minOdds:F2}, MaxCap: {maxConversion})",
            referenceId);

        _transactions.Add(transaction);
        Version++;

        AddDomainEvent(new BonusGrantedDomainEvent(
            Id,
            UserId,
            ActiveBonus.Id,
            bonusAmount,
            wageringRequirement,
            minOdds,
            maxConversion,
            Balance,
            transaction.Id,
            DateTimeOffset.UtcNow));

        AddDomainEvent(new BonusAddedDomainEvent(Id, UserId, bonusAmount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public Transaction PlaceBet(
        Money amount,
        SelectionId selectionId,
        string? description = null,
        string? referenceId = null,
        decimal? acceptedOdds = null,
        string? promoCode = null)
    {
        if (amount <= Money.Zero)
            throw new InvalidTransactionAmountException("Bet amount must be positive");

        if (acceptedOdds is <= 1m)
            throw new InvalidTransactionAmountException("Accepted odds must be greater than 1");

        EnsureSplitBalancesInitialized();

        var spendableReal = RealAvailable > Money.Zero ? RealAvailable : Money.Zero;
        var totalAvailable = spendableReal + BonusAvailable;
        if (totalAvailable < amount)
            throw new InsufficientFundsException(Id, amount, totalAvailable);

        // 1. Consumo Real-First: descuenta primero de RealAvailable positivo y completa con BonusAvailable
        var realStake = spendableReal >= amount ? amount : spendableReal;
        var bonusStake = amount - realStake;

        RealAvailable = Money.Signed(RealAvailable.Amount - realStake.Amount);
        RealLocked += realStake;

        BonusAvailable -= bonusStake;
        BonusLocked += bonusStake;

        // 2. Progreso de Rollover: solo apuestas con cuota >= MinOdds suman al WageredAmount
        if (ActiveBonus is { IsCompleted: false } &&
            acceptedOdds.HasValue &&
            acceptedOdds.Value >= ActiveBonus.MinOdds)
        {
            ActiveBonus.AddWager(amount);
            TryConvertRolloverBonus();
        }

        SyncBalances();

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            UserId,
            TransactionType.BetPlacement,
            amount,
            Balance,
            description,
            referenceId,
            selectionId: selectionId,
            acceptedOdds: acceptedOdds,
            promoCode: promoCode,
            betStatus: BetStatus.Pending,
            realStake: realStake,
            bonusStake: bonusStake);

        _transactions.Add(transaction);
        Version++;

        AddDomainEvent(new BetPlacedDomainEvent(Id, UserId, amount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public Transaction SettleBet(
        Transaction betTransaction,
        Money payoutAmount,
        SettlementResult result,
        string? description = null,
        string? referenceId = null)
    {
        ArgumentNullException.ThrowIfNull(betTransaction);

        if (betTransaction.WalletId != Id)
            throw new InvalidOperationException("La apuesta no pertenece a esta billetera.");

        var realStake = betTransaction.RealStake;
        var bonusStake = betTransaction.BonusStake;

        if (realStake == Money.Zero && bonusStake == Money.Zero && betTransaction.Amount > Money.Zero)
        {
            realStake = betTransaction.Amount;
        }

        return SettleBet(
            payoutAmount,
            result,
            realStake,
            bonusStake,
            description,
            referenceId ?? betTransaction.Id.Value.ToString(),
            referenceTransactionId: betTransaction.Id);
    }

    public Transaction SettleBet(
        Money amount,
        SettlementResult result,
        Money realStake,
        Money bonusStake,
        string? description = null,
        string? referenceId = null,
        TransactionId? referenceTransactionId = null)
    {
        if (amount <= Money.Zero)
            throw new InvalidTransactionAmountException("Settlement amount must be positive");

        EnsureSplitBalancesInitialized();

        // Liberar saldos bloqueados (RealLocked / BonusLocked) correspondientes a la apuesta
        RealLocked = RealLocked >= realStake ? RealLocked - realStake : Money.Zero;
        BonusLocked = BonusLocked >= bonusStake ? BonusLocked - bonusStake : Money.Zero;

        // En una apuesta ganadora el importe es el retorno bruto; en un void o
        // push se devuelve el stake. Una apuesta perdida no mueve saldo disponible.
        var netAmount = result is SettlementResult.Won or SettlementResult.Void or SettlementResult.Push
            ? amount
            : Money.Zero;

        Money realPayout = Money.Zero;
        Money bonusPayout = Money.Zero;

        if (netAmount > Money.Zero)
        {
            var totalStakeAmount = realStake.Amount + bonusStake.Amount;
            if (totalStakeAmount > 0m && bonusStake > Money.Zero)
            {
                var realRatio = realStake.Amount / totalStakeAmount;
                var calculatedReal = decimal.Round(netAmount.Amount * realRatio, 2, MidpointRounding.ToEven);
                realPayout = new Money(calculatedReal);
                bonusPayout = netAmount - realPayout;
            }
            else
            {
                realPayout = netAmount;
            }

            RealAvailable = Money.Signed(RealAvailable.Amount + realPayout.Amount);
            BonusAvailable += bonusPayout;
        }

        // Si el rollover ya alcanzó el 100%, convierte el saldo de bono disponible a real respetando MaxConversion
        TryConvertRolloverBonus();
        SyncBalances();

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            UserId,
            TransactionType.BetSettlement,
            netAmount,
            Balance,
            description,
            referenceId,
            realStake: realPayout,
            bonusStake: bonusPayout,
            referenceTransactionId: referenceTransactionId);

        _transactions.Add(transaction);
        Version++;

        AddDomainEvent(new BetSettledDomainEvent(Id, UserId, netAmount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public Transaction SettleBet(Money amount, SettlementResult result, string? description = null, string? referenceId = null)
    {
        var matchingBet = _transactions.FirstOrDefault(t =>
            t.Type == TransactionType.BetPlacement &&
            t.BetStatus == BetStatus.Pending &&
            (referenceId is null || t.Id.Value.ToString() == referenceId || t.ReferenceId == referenceId));

        if (matchingBet is not null)
        {
            return SettleBet(matchingBet, amount, result, description, referenceId);
        }

        return SettleBet(amount, result, RealLocked, BonusLocked, description, referenceId);
    }

    /// <summary>
    /// Liquida anticipadamente una apuesta pendiente (Cash Out). Libera el stake
    /// que permanecía bloqueado, acredita el importe calculado en
    /// <see cref="RealAvailable"/> y registra el movimiento en el ledger con
    /// estado <see cref="BetStatus.CashedOut"/>.
    /// </summary>
    public Transaction CashOut(
        Transaction betTransaction,
        Money cashOutAmount,
        MarketId marketId,
        decimal initialOdds,
        decimal currentOdds,
        decimal retentionMargin,
        string? description = null,
        string? referenceId = null)
    {
        ArgumentNullException.ThrowIfNull(betTransaction);

        if (betTransaction.WalletId != Id)
            throw new InvalidOperationException("La apuesta no pertenece a esta billetera.");

        if (betTransaction.Type != TransactionType.BetPlacement)
            throw new InvalidOperationException("Solo un cargo de apuesta puede liquidarse con Cash Out.");

        if (betTransaction.BetStatus is not null and not Zenbet.EventsMarkets.Domain.Enums.BetStatus.Pending)
            throw new InvalidOperationException($"La apuesta ya no está pendiente (estado: {betTransaction.BetStatus}).");

        if (cashOutAmount <= Money.Zero)
            throw new InvalidTransactionAmountException("Cash out amount must be positive");

        if (initialOdds <= 1m)
            throw new InvalidTransactionAmountException("Initial odds must be greater than 1");

        if (currentOdds < 1m)
            throw new InvalidTransactionAmountException("Current odds must be at least 1");

        if (retentionMargin is <= 0m or > 1m)
            throw new InvalidTransactionAmountException("Retention margin must be between 0 and 1");

        EnsureSplitBalancesInitialized();

        var realStake = betTransaction.RealStake;
        var bonusStake = betTransaction.BonusStake;

        if (realStake == Money.Zero && bonusStake == Money.Zero && betTransaction.Amount > Money.Zero)
        {
            realStake = betTransaction.Amount;
        }

        // 1. Liberar el stake bloqueado: el Cash Out sustituye la liquidación
        // deportiva, por lo que la casa deja de tener ese riesgo abierto.
        RealLocked = RealLocked >= realStake ? RealLocked - realStake : Money.Zero;
        BonusLocked = BonusLocked >= bonusStake ? BonusLocked - bonusStake : Money.Zero;

        // 2. Acreditar el valor de Cash Out (ya con margen de retención) en saldo real.
        RealAvailable = Money.Signed(RealAvailable.Amount + cashOutAmount.Amount);

        // 3. Cerrar el boleto original para que ningún worker de pagos lo liquide después.
        betTransaction.MarkCashedOut();

        TryConvertRolloverBonus();
        SyncBalances();

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            UserId,
            TransactionType.CashOut,
            cashOutAmount,
            Balance,
            description ?? $"Cash Out — Apuesta {betTransaction.Id.Value}",
            referenceId,
            selectionId: betTransaction.SelectionId,
            acceptedOdds: initialOdds,
            betStatus: Zenbet.EventsMarkets.Domain.Enums.BetStatus.CashedOut,
            referenceTransactionId: betTransaction.Id);
        transaction.Complete();

        _transactions.Add(transaction);
        Version++;

        AddDomainEvent(new BetCashedOutDomainEvent(
            Id,
            UserId,
            betTransaction.Id,
            transaction.Id,
            marketId,
            betTransaction.Amount,
            cashOutAmount,
            initialOdds,
            currentOdds,
            retentionMargin,
            RealAvailable,
            Balance,
            DateTimeOffset.UtcNow));

        return transaction;
    }

    public void ReleaseLockedStake(Transaction betTransaction)
    {
        ArgumentNullException.ThrowIfNull(betTransaction);

        EnsureSplitBalancesInitialized();

        var realStake = betTransaction.RealStake;
        var bonusStake = betTransaction.BonusStake;

        if (realStake == Money.Zero && bonusStake == Money.Zero && betTransaction.Amount > Money.Zero)
        {
            realStake = betTransaction.Amount;
        }

        RealLocked = RealLocked >= realStake ? RealLocked - realStake : Money.Zero;
        BonusLocked = BonusLocked >= bonusStake ? BonusLocked - bonusStake : Money.Zero;

        TryConvertRolloverBonus();
        SyncBalances();
        Version++;
    }

    private void TryConvertRolloverBonus()
    {
        if (ActiveBonus is not { IsCompleted: false, IsRolloverMet: true })
            return;

        var forfeited = Money.Zero;

        if (BonusAvailable > Money.Zero)
        {
            var remainingCap = ActiveBonus.MaxConversion > ActiveBonus.ConvertedAmount
                ? ActiveBonus.MaxConversion - ActiveBonus.ConvertedAmount
                : Money.Zero;

            var convertible = BonusAvailable <= remainingCap ? BonusAvailable : remainingCap;
            forfeited = BonusAvailable - convertible;

            BonusAvailable = Money.Zero;
            RealAvailable = Money.Signed(RealAvailable.Amount + convertible.Amount);
            ActiveBonus.RecordConversion(convertible, forfeited);
        }

        if (BonusLocked == Money.Zero)
        {
            ActiveBonus.MarkCompleted();
            SyncBalances();

            AddDomainEvent(new BonusRolloverCompletedDomainEvent(
                Id,
                UserId,
                ActiveBonus.Id,
                ActiveBonus.ConvertedAmount,
                forfeited,
                RealAvailable,
                Balance,
                DateTimeOffset.UtcNow));
        }
    }

    /// <summary>
    /// Ejecuta un Clawback contable sobre una liquidación previa (ej. corrección de VAR o descalificación).
    /// Permite que <see cref="RealAvailable"/> caiga en negativo (Deuda) si el jugador ya retiró o consumió
    /// las ganancias, y revierte tanto el progreso del <see cref="ActiveBonus"/> como cualquier conversión
    /// a saldo Real que haya sido disparada por la apuesta anulada.
    /// </summary>
    public Transaction ClawbackSettlement(TransactionId settlementTransactionId, string? reason = null)
    {
        var settlementTx = _transactions.FirstOrDefault(t =>
                t.Id == settlementTransactionId &&
                t.Type == TransactionType.BetSettlement)
            ?? throw new InvalidOperationException($"No se encontró la transacción de liquidación {settlementTransactionId}.");

        var originalBetTx = _transactions.FirstOrDefault(t =>
            t.Type == TransactionType.BetPlacement &&
            (settlementTx.ReferenceTransactionId == t.Id ||
             (settlementTx.ReferenceId is not null &&
              settlementTx.ReferenceId.EndsWith(t.Id.Value.ToString(), StringComparison.OrdinalIgnoreCase))));

        return ClawbackSettlement(settlementTx, originalBetTx, reason);
    }

    /// <summary>
    /// Sobrecarga de <see cref="ClawbackSettlement(TransactionId, string?)"/> para operaciones de
    /// re-liquidación masiva donde las transacciones se cargan desde el repositorio.
    /// </summary>
    public Transaction ClawbackSettlement(
        Transaction settlementTransaction,
        Transaction? originalBetTransaction = null,
        string? reason = null,
        bool revertBonusWager = true)
    {
        ArgumentNullException.ThrowIfNull(settlementTransaction);

        if (settlementTransaction.WalletId != Id)
            throw new InvalidOperationException("La liquidación no pertenece a esta billetera.");

        if (settlementTransaction.Type != TransactionType.BetSettlement)
            throw new InvalidOperationException("Solo una transacción de tipo BetSettlement puede ser objeto de Clawback.");

        if (settlementTransaction.Status == TransactionStatus.ClawedBack)
            throw new InvalidOperationException($"La liquidación {settlementTransaction.Id} ya fue revertida mediante Clawback.");

        EnsureSplitBalancesInitialized();

        var bonusConversionReversed = false;

        // 1. Reversión de Bono (WageredAmount y Conversión de Rollover)
        if (ActiveBonus is not null && revertBonusWager && originalBetTransaction is not null)
        {
            var betCountedTowardRollover = !originalBetTransaction.AcceptedOdds.HasValue ||
                                           originalBetTransaction.AcceptedOdds.Value >= ActiveBonus.MinOdds;

            if (betCountedTowardRollover)
            {
                ActiveBonus.RevertWager(originalBetTransaction.Amount);

                if (!ActiveBonus.IsRolloverMet && ActiveBonus.ConvertedAmount > Money.Zero)
                {
                    var convertedToReverse = ActiveBonus.ConvertedAmount;
                    var forfeitedToRestore = ActiveBonus.ForfeitedAmount;

                    // El dinero convertido vuelve a BonusAvailable y se resta de RealAvailable (pudiendo generar deuda)
                    RealAvailable = Money.Signed(RealAvailable.Amount - convertedToReverse.Amount);
                    BonusAvailable += convertedToReverse + forfeitedToRestore;

                    ActiveBonus.RevertConversion();
                    bonusConversionReversed = true;
                }
                else if (!ActiveBonus.IsRolloverMet && ActiveBonus.IsCompleted)
                {
                    ActiveBonus.RevertConversion();
                }
            }
        }

        // 2. Descuento del pago anulado con soporte de Saldo Negativo (Deuda en RealAvailable)
        var realPayout = settlementTransaction.RealStake;
        var bonusPayout = settlementTransaction.BonusStake;

        if (realPayout == Money.Zero && bonusPayout == Money.Zero && settlementTransaction.Amount > Money.Zero)
        {
            realPayout = settlementTransaction.Amount;
        }

        var bonusRecovered = BonusAvailable >= bonusPayout ? bonusPayout : BonusAvailable;
        var unrecoveredBonusShortfall = bonusPayout - bonusRecovered;
        BonusAvailable -= bonusRecovered;

        // Si BonusAvailable tampoco alcanza (porque el jugador ya gastó ese bono), el déficit se cobra a RealAvailable
        var totalRealClawback = realPayout + unrecoveredBonusShortfall;
        RealAvailable = Money.Signed(RealAvailable.Amount - totalRealClawback.Amount);

        // 3. Reabrir la apuesta original y restaurar su bloqueo hasta que se aplique el nuevo resultado
        if (originalBetTransaction is not null)
        {
            var origReal = originalBetTransaction.RealStake;
            var origBonus = originalBetTransaction.BonusStake;
            if (origReal == Money.Zero && origBonus == Money.Zero && originalBetTransaction.Amount > Money.Zero)
            {
                origReal = originalBetTransaction.Amount;
            }

            RealLocked += origReal;
            BonusLocked += origBonus;
            originalBetTransaction.ReopenForResettlement();
        }

        settlementTransaction.MarkClawedBack(reason);
        SyncBalances();

        var clawbackDescription = string.IsNullOrWhiteSpace(reason)
            ? $"VAR Clawback · Anulación de liquidación {settlementTransaction.Id.Value}"
            : $"VAR Clawback ({reason.Trim()}) · Liquidación {settlementTransaction.Id.Value}";

        var clawbackTransaction = new Transaction(
            TransactionId.New(),
            Id,
            UserId,
            TransactionType.Clawback,
            settlementTransaction.Amount,
            Balance,
            clawbackDescription,
            $"CLAWBACK:{settlementTransaction.Id.Value}",
            realStake: totalRealClawback,
            bonusStake: bonusRecovered,
            referenceTransactionId: settlementTransaction.Id);
        clawbackTransaction.Complete();

        _transactions.Add(clawbackTransaction);
        Version++;

        AddDomainEvent(new SettlementClawedBackDomainEvent(
            Id,
            UserId,
            clawbackTransaction.Id,
            settlementTransaction.Id,
            settlementTransaction.Amount,
            RealAvailable,
            BonusAvailable,
            Balance,
            bonusConversionReversed,
            reason,
            DateTimeOffset.UtcNow));

        return clawbackTransaction;
    }

    public Transaction CancelBet(Money amount, string? description = null, string? referenceId = null)
    {
        if (amount <= Money.Zero)
            throw new InvalidTransactionAmountException("Cancellation amount must be positive");

        EnsureSplitBalancesInitialized();

        var matchingBet = _transactions.FirstOrDefault(t =>
            t.Type == TransactionType.BetPlacement &&
            t.BetStatus == BetStatus.Pending &&
            (referenceId is null || t.Id.Value.ToString() == referenceId || t.ReferenceId == referenceId));

        if (matchingBet is not null && (matchingBet.RealStake > Money.Zero || matchingBet.BonusStake > Money.Zero))
        {
            RealLocked = RealLocked >= matchingBet.RealStake ? RealLocked - matchingBet.RealStake : Money.Zero;
            BonusLocked = BonusLocked >= matchingBet.BonusStake ? BonusLocked - matchingBet.BonusStake : Money.Zero;
            RealAvailable = Money.Signed(RealAvailable.Amount + matchingBet.RealStake.Amount);
            BonusAvailable += matchingBet.BonusStake;
        }
        else
        {
            var unlockReal = RealLocked >= amount ? amount : RealLocked;
            var unlockBonus = amount - unlockReal;
            RealLocked -= unlockReal;
            BonusLocked = BonusLocked >= unlockBonus ? BonusLocked - unlockBonus : Money.Zero;
            RealAvailable = Money.Signed(RealAvailable.Amount + unlockReal.Amount);
            BonusAvailable += unlockBonus;
        }

        SyncBalances();

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            UserId,
            TransactionType.BetCancellation,
            amount,
            Balance,
            description,
            referenceId);

        _transactions.Add(transaction);
        Version++;

        AddDomainEvent(new BetCancelledDomainEvent(Id, UserId, amount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public Transaction AddBonus(Money amount, string? description = null, string? referenceId = null)
    {
        if (amount <= Money.Zero)
            throw new InvalidTransactionAmountException("Bonus amount must be positive");

        EnsureSplitBalancesInitialized();

        BonusAvailable += amount;
        SyncBalances();

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            UserId,
            TransactionType.Bonus,
            amount,
            Balance,
            description,
            referenceId);

        _transactions.Add(transaction);
        Version++;

        AddDomainEvent(new BonusAddedDomainEvent(Id, UserId, amount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public Transaction Adjust(Money amount, string? description = null, string? referenceId = null)
    {
        EnsureSplitBalancesInitialized();

        var newBalance = Balance + amount;
        if (newBalance < Money.Zero)
            throw new InsufficientFundsException(Id, Money.Zero - newBalance, Balance);

        if (amount >= Money.Zero)
        {
            RealAvailable += amount;
        }
        else
        {
            var deduction = Money.Zero - amount;
            var realDeduction = RealAvailable >= deduction ? deduction : RealAvailable;
            var bonusDeduction = deduction - realDeduction;
            RealAvailable -= realDeduction;
            BonusAvailable -= bonusDeduction;
        }

        SyncBalances();

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            UserId,
            TransactionType.Adjustment,
            amount,
            Balance,
            description,
            referenceId);

        _transactions.Add(transaction);
        Version++;

        AddDomainEvent(new WalletAdjustedDomainEvent(Id, UserId, amount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public Transaction PlaceRgsBet(
        Money amount,
        string providerTransactionId,
        string gameId,
        string roundId,
        string? description = null)
    {
        if (amount <= Money.Zero)
            throw new InvalidTransactionAmountException("RGS bet amount must be positive");

        if (string.IsNullOrWhiteSpace(providerTransactionId))
            throw new ArgumentException("ProviderTransactionId is required", nameof(providerTransactionId));

        EnsureSplitBalancesInitialized();

        var spendableReal = RealAvailable > Money.Zero ? RealAvailable : Money.Zero;
        var totalAvailable = spendableReal + BonusAvailable;
        if (totalAvailable < amount)
            throw new InsufficientFundsException(Id, amount, totalAvailable);

        // Consumo Real-First: deduce primero de RealAvailable positivo y completa con BonusAvailable
        var realStake = spendableReal >= amount ? amount : spendableReal;
        var bonusStake = amount - realStake;

        RealAvailable = Money.Signed(RealAvailable.Amount - realStake.Amount);
        BonusAvailable -= bonusStake;

        if (ActiveBonus is { IsCompleted: false })
        {
            ActiveBonus.AddWager(amount);
            TryConvertRolloverBonus();
        }

        SyncBalances();

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            UserId,
            TransactionType.BetPlacement,
            amount,
            Balance,
            description ?? $"RGS Bet · Game {gameId} · Round {roundId}",
            providerTransactionId.Trim(),
            promoCode: roundId,
            betStatus: BetStatus.Pending,
            realStake: realStake,
            bonusStake: bonusStake);
        transaction.Complete();

        _transactions.Add(transaction);
        Version++;

        AddDomainEvent(new BetPlacedDomainEvent(Id, UserId, amount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public Transaction CreditRgsWin(
        Money winAmount,
        string providerTransactionId,
        Transaction? originalBetTransaction,
        string gameId,
        string roundId,
        string? description = null)
    {
        if (winAmount < Money.Zero)
            throw new InvalidTransactionAmountException("RGS win amount cannot be negative");

        if (string.IsNullOrWhiteSpace(providerTransactionId))
            throw new ArgumentException("ProviderTransactionId is required", nameof(providerTransactionId));

        EnsureSplitBalancesInitialized();

        Money realPayout = Money.Zero;
        Money bonusPayout = Money.Zero;

        if (winAmount > Money.Zero)
        {
            var realStake = originalBetTransaction?.RealStake ?? Money.Zero;
            var bonusStake = originalBetTransaction?.BonusStake ?? Money.Zero;
            var totalStakeAmount = realStake.Amount + bonusStake.Amount;

            if (totalStakeAmount > 0m && bonusStake > Money.Zero)
            {
                var realRatio = realStake.Amount / totalStakeAmount;
                var calculatedReal = decimal.Round(winAmount.Amount * realRatio, 2, MidpointRounding.ToEven);
                realPayout = new Money(calculatedReal);
                bonusPayout = winAmount - realPayout;
            }
            else
            {
                realPayout = winAmount;
            }

            RealAvailable = Money.Signed(RealAvailable.Amount + realPayout.Amount);
            BonusAvailable += bonusPayout;
        }

        TryConvertRolloverBonus();
        SyncBalances();

        var transaction = new Transaction(
            TransactionId.New(),
            Id,
            UserId,
            TransactionType.BetSettlement,
            winAmount,
            Balance,
            description ?? $"RGS Win · Game {gameId} · Round {roundId}",
            providerTransactionId.Trim(),
            promoCode: roundId,
            realStake: realPayout,
            bonusStake: bonusPayout,
            referenceTransactionId: originalBetTransaction?.Id);
        transaction.Complete();

        _transactions.Add(transaction);
        Version++;

        AddDomainEvent(new BetSettledDomainEvent(Id, UserId, winAmount, Balance, transaction.Id, DateTimeOffset.UtcNow));
        return transaction;
    }

    public Transaction RollbackRgsBet(
        string providerTransactionId,
        Transaction? existingBetTransaction,
        string? roundId = null,
        string? description = null)
    {
        if (string.IsNullOrWhiteSpace(providerTransactionId))
            throw new ArgumentException("ProviderTransactionId is required", nameof(providerTransactionId));

        EnsureSplitBalancesInitialized();

        // Patrón Tombstone: si la apuesta original nunca llegó por timeout de red,
        // registramos una lápida (Tombstone) con el mismo ReferenceId para bloquear
        // cualquier reintento tardío del proveedor.
        if (existingBetTransaction is null)
        {
            var tombstone = new Transaction(
                TransactionId.New(),
                Id,
                UserId,
                TransactionType.BetCancellation,
                Money.Zero,
                Balance,
                description ?? $"RGS_TOMBSTONE · Rollback preventivo para {providerTransactionId.Trim()}",
                providerTransactionId.Trim(),
                promoCode: roundId,
                betStatus: BetStatus.Void,
                realStake: Money.Zero,
                bonusStake: Money.Zero);
            tombstone.Cancel();

            _transactions.Add(tombstone);
            Version++;
            return tombstone;
        }

        var realRefund = existingBetTransaction.RealStake;
        var bonusRefund = existingBetTransaction.BonusStake;

        if (realRefund == Money.Zero && bonusRefund == Money.Zero && existingBetTransaction.Amount > Money.Zero)
        {
            realRefund = existingBetTransaction.Amount;
        }

        RealAvailable = Money.Signed(RealAvailable.Amount + realRefund.Amount);
        BonusAvailable += bonusRefund;
        SyncBalances();

        existingBetTransaction.MarkRgsRolledBack();

        var rollbackTx = new Transaction(
            TransactionId.New(),
            Id,
            UserId,
            TransactionType.BetCancellation,
            existingBetTransaction.Amount,
            Balance,
            description ?? $"RGS Rollback · Tx {providerTransactionId.Trim()}",
            $"ROLLBACK:{providerTransactionId.Trim()}",
            promoCode: roundId ?? existingBetTransaction.PromoCode,
            betStatus: BetStatus.Void,
            realStake: realRefund,
            bonusStake: bonusRefund,
            referenceTransactionId: existingBetTransaction.Id);
        rollbackTx.Complete();

        _transactions.Add(rollbackTx);
        Version++;

        AddDomainEvent(new BetCancelledDomainEvent(Id, UserId, existingBetTransaction.Amount, Balance, rollbackTx.Id, DateTimeOffset.UtcNow));
        return rollbackTx;
    }
}

public sealed class ActiveBonus : Entity<BonusId>
{
    private ActiveBonus() { } // EF Core

    [SetsRequiredMembers]
    public ActiveBonus(
        BonusId id,
        Money initialAmount,
        Money wageringRequirement,
        decimal minOdds,
        Money maxConversion)
        : base(id)
    {
        if (initialAmount <= Money.Zero)
            throw new InvalidTransactionAmountException("Initial bonus amount must be positive");

        if (wageringRequirement <= Money.Zero)
            throw new InvalidTransactionAmountException("Wagering requirement must be positive");

        if (minOdds <= 1m)
            throw new InvalidTransactionAmountException("Minimum odds must be greater than 1.00");

        if (maxConversion <= Money.Zero)
            throw new InvalidTransactionAmountException("Max conversion must be positive");

        InitialAmount = initialAmount;
        WageringRequirement = wageringRequirement;
        WageredAmount = Money.Zero;
        MinOdds = minOdds;
        MaxConversion = maxConversion;
        ConvertedAmount = Money.Zero;
        ForfeitedAmount = Money.Zero;
        IsCompleted = false;
        CreatedAt = DateTimeOffset.UtcNow;
    }

    public required Money InitialAmount { get; init; }
    public required Money WageringRequirement { get; init; }
    public Money WageredAmount { get; private set; }
    public required decimal MinOdds { get; init; }
    public required Money MaxConversion { get; init; }
    public Money ConvertedAmount { get; private set; }
    public Money ForfeitedAmount { get; private set; }
    public bool IsCompleted { get; private set; }
    public required DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? CompletedAt { get; private set; }

    public bool IsRolloverMet => WageredAmount >= WageringRequirement;

    public decimal ProgressPercentage =>
        WageringRequirement.Amount <= 0m
            ? 100m
            : Math.Min(100m, decimal.Round((WageredAmount.Amount / WageringRequirement.Amount) * 100m, 2, MidpointRounding.ToEven));

    public void AddWager(Money stake)
    {
        if (stake <= Money.Zero || IsCompleted)
            return;

        WageredAmount += stake;
    }

    public void RevertWager(Money stake)
    {
        if (stake <= Money.Zero)
            return;

        WageredAmount = WageredAmount >= stake
            ? WageredAmount - stake
            : Money.Zero;
    }

    public void RecordConversion(Money convertedRealAmount, Money? forfeitedBonusAmount = null)
    {
        if (convertedRealAmount > Money.Zero)
        {
            ConvertedAmount += convertedRealAmount;
        }

        if (forfeitedBonusAmount.HasValue && forfeitedBonusAmount.Value > Money.Zero)
        {
            ForfeitedAmount += forfeitedBonusAmount.Value;
        }
    }

    public void RevertConversion()
    {
        ConvertedAmount = Money.Zero;
        ForfeitedAmount = Money.Zero;
        IsCompleted = false;
        CompletedAt = null;
    }

    public void MarkCompleted()
    {
        if (IsCompleted)
            return;

        IsCompleted = true;
        CompletedAt = DateTimeOffset.UtcNow;
    }
}

public sealed class Transaction : Entity<TransactionId>
{
    private Transaction() { } // EF Core

    [SetsRequiredMembers]
    public Transaction(
        TransactionId id,
        WalletId walletId,
        UserId userId,
        TransactionType type,
        Money amount,
        Money balanceAfter,
        string? description = null,
        string? referenceId = null,
        PaymentMethod? method = null,
        SelectionId? selectionId = null,
        decimal? acceptedOdds = null,
        string? promoCode = null,
        BetStatus? betStatus = null,
        Money? realStake = null,
        Money? bonusStake = null,
        TransactionId? referenceTransactionId = null)
        : base(id)
    {
        WalletId = walletId;
        UserId = userId;
        Type = type;
        Amount = amount;
        BalanceAfter = balanceAfter;
        Description = description;
        ReferenceId = referenceId;
        ReferenceTransactionId = referenceTransactionId;
        Method = method;
        SelectionId = selectionId;
        AcceptedOdds = acceptedOdds;
        PromoCode = string.IsNullOrWhiteSpace(promoCode) ? null : promoCode.Trim().ToUpperInvariant();
        BetStatus = betStatus;
        RealStake = realStake ?? (type == TransactionType.BetPlacement ? amount : Money.Zero);
        BonusStake = bonusStake ?? Money.Zero;
        Status = TransactionStatus.Pending;
        CreatedAt = DateTimeOffset.UtcNow;
    }

    public required WalletId WalletId { get; init; }
    public required UserId UserId { get; init; }
    public required TransactionType Type { get; init; }
    public required Money Amount { get; init; }
    public Money RealStake { get; private set; }
    public Money BonusStake { get; private set; }
    public Money BalanceAfter { get; private set; }
    public string? Description { get; init; }
    public string? ReferenceId { get; init; }

    /// <summary>
    /// Puntero contable hacia la transacción original (ej. de un <see cref="TransactionType.Clawback"/>
    /// hacia el <see cref="TransactionType.BetSettlement"/> anulado, o de una liquidación hacia su apuesta).
    /// </summary>
    public TransactionId? ReferenceTransactionId { get; private set; }
    public PaymentMethod? Method { get; init; }
    public SelectionId? SelectionId { get; init; }

    /// <summary>Cuota aceptada al confirmar la apuesta; base del pago real.</summary>
    public decimal? AcceptedOdds { get; init; }

    /// <summary>Código promocional aplicado al boleto, si existe.</summary>
    public string? PromoCode { get; init; }

    /// <summary>Estado deportivo de la apuesta (solo para cargos de apuesta).</summary>
    public BetStatus? BetStatus { get; private set; }

    public TransactionStatus Status { get; private set; }
    public required DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public string? FailureReason { get; private set; }

    public static Transaction CreatePendingDeposit(
        WalletId walletId,
        UserId userId,
        Money amount,
        PaymentMethod method,
        string reference,
        Money currentBalance)
    {
        if (amount <= Money.Zero)
            throw new InvalidTransactionAmountException("El monto del depósito debe ser mayor a cero.");

        if (string.IsNullOrWhiteSpace(reference))
            throw new ArgumentException("La referencia del depósito es obligatoria.", nameof(reference));

        var normalizedReference = reference.Trim();
        if (normalizedReference.Length > 100)
            throw new ArgumentException("La referencia del depósito no puede superar los 100 caracteres.", nameof(reference));

        return new Transaction(
            TransactionId.New(),
            walletId,
            userId,
            TransactionType.Deposit,
            amount,
            currentBalance,
            referenceId: normalizedReference,
            method: method);
    }

    public void Approve(Money newBalance)
    {
        if (Type != TransactionType.Deposit)
            throw new InvalidOperationException("Solo un depósito puede aprobarse.");

        if (Status != TransactionStatus.Pending)
            throw new InvalidOperationException($"No se puede aprobar una transacción en estado {Status}.");

        Status = TransactionStatus.Approved;
        BalanceAfter = newBalance;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    public void Reject(string reason)
    {
        if (Type != TransactionType.Deposit)
            throw new InvalidOperationException("Solo un depósito puede rechazarse.");

        if (Status != TransactionStatus.Pending)
            throw new InvalidOperationException($"No se puede rechazar una transacción en estado {Status}.");

        Status = TransactionStatus.Rejected;
        FailureReason = string.IsNullOrWhiteSpace(reason) ? "Rechazado por administración" : reason.Trim();
        CompletedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Marca la apuesta como ganadora, perdedora o anulada. El movimiento de
    /// cargo queda completado en el mismo acto para que la billetera y el
    /// historial deportivo compartan la misma línea temporal.
    /// </summary>
    public void SettleBet(BetStatus outcome)
    {
        if (Type != TransactionType.BetPlacement)
            throw new InvalidOperationException("Solo un cargo de apuesta puede liquidarse.");

        if (outcome == Zenbet.EventsMarkets.Domain.Enums.BetStatus.Pending)
            throw new ArgumentOutOfRangeException(nameof(outcome), "El resultado de la apuesta no puede ser Pending.");

        if (BetStatus.HasValue && BetStatus.Value != Zenbet.EventsMarkets.Domain.Enums.BetStatus.Pending)
            throw new InvalidOperationException($"La apuesta ya fue liquidada como {BetStatus}.");

        BetStatus = outcome;

        if (Status == TransactionStatus.Pending)
            Complete();
    }

    /// <summary>
    /// Cierra el cargo de apuesta como liquidado anticipadamente por el jugador.
    /// A diferencia de <see cref="SettleBet(BetStatus)"/>, el resultado no es
    /// deportivo sino comercial: el boleto deja de ser pendiente y no puede
    /// volver a liquidarse ni pagarse por el worker.
    /// </summary>
    public void MarkCashedOut()
    {
        if (Type != TransactionType.BetPlacement)
            throw new InvalidOperationException("Solo un cargo de apuesta puede cerrarse con Cash Out.");

        if (BetStatus.HasValue && BetStatus.Value != Zenbet.EventsMarkets.Domain.Enums.BetStatus.Pending)
            throw new InvalidOperationException($"La apuesta ya fue liquidada como {BetStatus}.");

        BetStatus = Zenbet.EventsMarkets.Domain.Enums.BetStatus.CashedOut;

        if (Status == TransactionStatus.Pending)
            Complete();
    }

    public void Complete()
    {
        if (Status != TransactionStatus.Pending)
            throw new InvalidOperationException($"Cannot complete transaction in status {Status}");

        Status = TransactionStatus.Completed;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    public void Fail(string reason)
    {
        if (Status != TransactionStatus.Pending)
            throw new InvalidOperationException($"Cannot fail transaction in status {Status}");

        Status = TransactionStatus.Failed;
        FailureReason = reason ?? "Unknown failure";
    }

    public void Cancel()
    {
        if (Status != TransactionStatus.Pending)
            throw new InvalidOperationException($"Cannot cancel transaction in status {Status}");

        Status = TransactionStatus.Cancelled;
    }

    public void MarkRgsRolledBack()
    {
        BetStatus = Zenbet.EventsMarkets.Domain.Enums.BetStatus.Void;
        Status = TransactionStatus.Cancelled;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    public void MarkClawedBack(string? reason = null)
    {
        if (Type != TransactionType.BetSettlement)
            throw new InvalidOperationException("Solo una liquidación de apuesta puede marcarse como ClawedBack.");

        Status = TransactionStatus.ClawedBack;
        FailureReason = string.IsNullOrWhiteSpace(reason) ? "Revertida por Clawback (VAR)" : reason.Trim();
    }

    public void ReopenForResettlement()
    {
        if (Type != TransactionType.BetPlacement)
            throw new InvalidOperationException("Solo un cargo de apuesta puede reabrirse para re-liquidación.");

        BetStatus = Zenbet.EventsMarkets.Domain.Enums.BetStatus.Pending;
    }
}