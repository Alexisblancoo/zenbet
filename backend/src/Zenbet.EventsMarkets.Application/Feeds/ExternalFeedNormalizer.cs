namespace Zenbet.EventsMarkets.Application.Feeds;

using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Commands.SettleMarket;
using Zenbet.EventsMarkets.Application.Commands.UpdateOdds;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Implementación de referencia del normalizador de feeds externos.
/// Sanitiza datos de proveedores externos antes de ingresarlos al bus de comandos.
/// </summary>
public sealed class ExternalFeedNormalizer : IExternalFeedNormalizer
{
    private readonly ILogger<ExternalFeedNormalizer> _logger;

    public ExternalFeedNormalizer(ILogger<ExternalFeedNormalizer> logger)
    {
        _logger = logger;
    }

    public FeedNormalizationResult<UpdateOddsCommand> NormalizeMinifiedOdds(MinifiedFeedBatch batch)
    {
        if (batch?.Items is null || batch.Items.Count == 0)
        {
            return new FeedNormalizationResult<UpdateOddsCommand>(false, null, ["El lote minificado no contiene items."]);
        }

        var errors = new List<string>();
        var items = new List<OddsUpdateItem>();
        var timestamp = batch.TimestampEpochMs > 0
            ? DateTimeOffset.FromUnixTimeMilliseconds(batch.TimestampEpochMs)
            : DateTimeOffset.UtcNow;

        foreach (var raw in batch.Items)
        {
            if (string.IsNullOrWhiteSpace(raw.SelectionId))
            {
                errors.Add("Item sin SelectionId (clave 'I').");
                continue;
            }

            if (!Guid.TryParse(raw.SelectionId, out var parsedGuid))
            {
                errors.Add($"SelectionId inválido: '{raw.SelectionId}'.");
                continue;
            }

            if (raw.Coeff <= 1.0m)
            {
                errors.Add($"Cuota inválida ({raw.Coeff}) para selección '{raw.SelectionId}'. Debe ser mayor a 1.0.");
                continue;
            }

            items.Add(new OddsUpdateItem(
                SelectionId.From(parsedGuid),
                raw.Coeff,
                timestamp,
                raw.Provider ?? "MinifiedFeed"
            ));
        }

        if (items.Count == 0)
        {
            return new FeedNormalizationResult<UpdateOddsCommand>(false, null, errors);
        }

        var idempotencyKey = batch.BatchId ?? GenerateDeterministicGuid(batch.TimestampEpochMs, items);
        var command = new UpdateOddsCommand(items, idempotencyKey);

        _logger.LogDebug("Normalizados {Count} coeficientes desde lote minificado", items.Count);
        return new FeedNormalizationResult<UpdateOddsCommand>(true, command, errors);
    }

    public FeedNormalizationResult<UpdateOddsCommand> NormalizeIndustryOdds(
        IReadOnlyList<IndustryFeedUpdate> updates,
        Guid? batchId = null)
    {
        if (updates is null || updates.Count == 0)
        {
            return new FeedNormalizationResult<UpdateOddsCommand>(false, null, ["La lista de actualizaciones de industria está vacía."]);
        }

        var errors = new List<string>();
        var items = new List<OddsUpdateItem>();

        foreach (var update in updates)
        {
            if (!Guid.TryParse(update.SelectionId, out var selectionGuid))
            {
                errors.Add($"SelectionId inválido: '{update.SelectionId}'.");
                continue;
            }

            if (update.Odds <= 1.0m)
            {
                errors.Add($"Cuota inválida ({update.Odds}) para selección '{update.SelectionId}'.");
                continue;
            }

            items.Add(new OddsUpdateItem(
                SelectionId.From(selectionGuid),
                update.Odds,
                update.Timestamp,
                string.IsNullOrWhiteSpace(update.Provider) ? "IndustryFeed" : update.Provider
            ));
        }

        if (items.Count == 0)
        {
            return new FeedNormalizationResult<UpdateOddsCommand>(false, null, errors);
        }

        var idempotencyKey = batchId ?? GenerateDeterministicGuid(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), items);
        var command = new UpdateOddsCommand(items, idempotencyKey);

        _logger.LogDebug("Normalizadas {Count} cuotas desde feed B2B industrial", items.Count);
        return new FeedNormalizationResult<UpdateOddsCommand>(true, command, errors);
    }

    public FeedNormalizationResult<SettleMarketCommand> NormalizeSettlement(
        IndustryFeedUpdate update,
        Guid? idempotencyKey = null)
    {
        if (string.IsNullOrWhiteSpace(update.MarketId) || !Guid.TryParse(update.MarketId, out var marketGuid))
        {
            return new FeedNormalizationResult<SettleMarketCommand>(false, null, ["MarketId ausente o inválido."]);
        }

        if (string.IsNullOrWhiteSpace(update.WinnerSelectionId) || !Guid.TryParse(update.WinnerSelectionId, out var winnerGuid))
        {
            return new FeedNormalizationResult<SettleMarketCommand>(false, null, ["WinnerSelectionId ausente o inválido."]);
        }

        var result = update.SettlementResult ?? SettlementResult.Won;
        var key = idempotencyKey ?? Guid.NewGuid();

        var command = new SettleMarketCommand(
            MarketId.From(marketGuid),
            SelectionId.From(winnerGuid),
            result,
            update.Provider ?? "ExternalFeed",
            key
        );

        _logger.LogInformation("Normalizada liquidación para mercado {MarketId}, ganador {WinnerSelectionId}", marketGuid, winnerGuid);
        return new FeedNormalizationResult<SettleMarketCommand>(true, command, []);
    }

    private static Guid GenerateDeterministicGuid(long timestamp, IReadOnlyList<OddsUpdateItem> items)
    {
        var sb = new StringBuilder();
        sb.Append(timestamp);
        foreach (var item in items)
        {
            sb.Append('|').Append(item.SelectionId.Value).Append(':').Append(item.Value);
        }
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(sb.ToString()));
        var guidBytes = new byte[16];
        Array.Copy(hash, 0, guidBytes, 0, 16);
        return new Guid(guidBytes);
    }
}

