namespace Zenbet.EventsMarkets.Domain.Enums;

public enum EventStatus
{
    Scheduled = 1,
    Live = 2,
    Suspended = 3,
    Finished = 4,
    Cancelled = 5,
    Void = 6
}

public enum MarketStatus
{
    Open = 1,
    Suspended = 2,
    Settled = 3,
    Void = 4
}

public enum SettlementResult
{
    Won = 1,
    Lost = 2,
    Void = 3,
    Push = 4
}

public enum SportType
{
    Football = 1,
    Tennis = 2,
    Basketball = 3,
    IceHockey = 4,
    Baseball = 5,
    AmericanFootball = 6,
    Cricket = 7,
    Esports = 8,
    Other = 99
}

public enum MarketType
{
    MatchWinner = 1,
    DoubleChance = 2,
    TotalGoals = 3,
    BothTeamsToScore = 4,
    CorrectScore = 5,
    HalfTimeFullTime = 6,
    AsianHandicap = 7,
    PlayerProps = 8,
    Other = 99
}

public enum TransactionType
{
    Deposit = 1,
    Withdrawal = 2,
    BetPlacement = 3,
    BetSettlement = 4,
    BetCancellation = 5,
    Bonus = 6,
    Adjustment = 7
}

public enum TransactionStatus
{
    Pending = 1,
    Completed = 2,
    Failed = 3,
    Cancelled = 4
}