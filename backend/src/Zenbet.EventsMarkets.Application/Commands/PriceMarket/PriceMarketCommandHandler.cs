namespace Zenbet.EventsMarkets.Application.Commands.PriceMarket;

using System.Security.Cryptography;
using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Common;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Events;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Pricing;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

public sealed class PriceMarketCommandHandler : IRequestHandler<PriceMarketCommand, PriceMarketResult>
{
    private const string ProviderName = "ZenBet Trading";

    private readonly IMarketRepository _marketRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOutboxWriter _outboxWriter;
    private readonly IIdempotencyService _idempotencyService;
    private readonly ILogger<PriceMarketCommandHandler> _logger;

    public PriceMarketCommandHandler(
        IMarketRepository marketRepository,
        IUnitOfWork unitOfWork,
        IOutboxWriter outboxWriter,
        IIdempotencyService idempotencyService,
        ILogger<PriceMarketCommandHandler> logger)
    {
        _marketRepository = marketRepository;
        _unitOfWork = unitOfWork;
        _outboxWriter = outboxWriter;
        _idempotencyService = idempotencyService;
        _logger = logger;
    }

    public async Task<PriceMarketResult> Handle(PriceMarketCommand request, CancellationToken cancellationToken)
    {
        // Validación pura primero: una cotización inválida falla antes de tocar la base de datos.
        var pricing = OddsPricing.Price(request.Selections, request.MarginPercent);

        var idempotencyKey = request.IdempotencyKey.ToString();
        var payloadHash = IdempotencyPayloadHasher.Compute(new
        {
            marketId = request.MarketId.Value,
            request.MarginPercent,
            selections = request.Selections
                .OrderBy(s => s.SelectionId.Value)
                .Select(s => new { id = s.SelectionId.Value, p = s.FairProbability }),
            request.Note,
        });

        if (await _idempotencyService.ExistsAsync(idempotencyKey, nameof(PriceMarketCommand), payloadHash, cancellationToken))
        {
            return ToResult(request, pricing, idempotentReplay: true);
        }

        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            await _unitOfWork.TryAcquireAdvisoryLockAsync(
                BitConverter.ToInt64(request.IdempotencyKey.ToByteArray(), 0),
                cancellationToken);

            // Mismo bloqueo de mercado que PlaceBet: una apuesta nunca ve un mercado a medio recotizar.
            await _unitOfWork.TryAcquireAdvisoryLockAsync(MarketLockKey(request.MarketId), cancellationToken);

            if (await _idempotencyService.ExistsAsync(idempotencyKey, nameof(PriceMarketCommand), payloadHash, cancellationToken))
            {
                await _unitOfWork.CommitAsync(cancellationToken);
                return ToResult(request, pricing, idempotentReplay: true);
            }

            var market = await _marketRepository.GetByIdWithSelectionsAsync(request.MarketId, cancellationToken)
                ?? throw new MarketNotFoundException(request.MarketId);

            if (market.Status is MarketStatus.Settled or MarketStatus.Void)
            {
                throw new InvalidPricingException("El mercado ya está liquidado o anulado y no se puede recotizar.");
            }

            var marketSelectionIds = market.Selections.Select(s => s.Id).ToHashSet();
            var requestedIds = request.Selections.Select(s => s.SelectionId).ToHashSet();
            if (!marketSelectionIds.SetEquals(requestedIds))
            {
                throw new InvalidPricingException(
                    "Debes enviar exactamente las selecciones del mercado: no se admiten cotizaciones parciales.");
            }

            var now = DateTimeOffset.UtcNow;
            var changes = new List<OddsChangedDomainEvent>(pricing.Selections.Count);

            foreach (var priced in pricing.Selections)
            {
                var selection = market.Selections.Single(s => s.Id == priced.SelectionId);
                var previous = selection.CurrentOdd;
                selection.UpdateOdd(new Odd(priced.DecimalOdds, now, ProviderName), now);
                changes.Add(new OddsChangedDomainEvent(market.Id, selection.Id, previous, selection.CurrentOdd, now));
            }

            // Pasa a ser una cuota del operador: ejecutable y trazable a quién la fijó.
            market.SetProvenance(new MarketProvenance(
                ProviderName,
                OddsSourceKind.Operator,
                url: null,
                observedAt: now,
                note: BuildNote(request, pricing)));

            await _marketRepository.UpdateAsync(market, cancellationToken);

            foreach (var change in changes)
            {
                await _outboxWriter.WriteAsync(change, cancellationToken);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _idempotencyService.AddAsync(idempotencyKey, nameof(PriceMarketCommand), cancellationToken, payloadHash);
            await _unitOfWork.CommitAsync(cancellationToken);

            _logger.LogWarning(
                "Mercado {MarketId} cotizado por {PricedBy}: margen {Margin}% (overround {Overround}%), {Count} selecciones.",
                market.Id.Value, request.PricedBy, request.MarginPercent, pricing.OverroundPercent, changes.Count);

            return ToResult(request, pricing, idempotentReplay: false);
        }
        catch
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private static PriceMarketResult ToResult(PriceMarketCommand request, MarketPricing pricing, bool idempotentReplay) =>
        new(request.MarketId, pricing.OverroundPercent, pricing.Selections, idempotentReplay);

    private static string BuildNote(PriceMarketCommand request, MarketPricing pricing)
    {
        var note = $"Cotizado por {request.PricedBy}; margen {request.MarginPercent}% (overround {pricing.OverroundPercent}%).";
        return string.IsNullOrWhiteSpace(request.Note) ? note : $"{note} {request.Note.Trim()}";
    }

    private static long MarketLockKey(MarketId marketId)
    {
        // Debe ser idéntica a la de PlaceBetCommandHandler.ComputeMarketAdvisoryLockKey.
        var hash = SHA256.HashData(marketId.Value.ToByteArray());
        return BitConverter.ToInt64(hash, 0);
    }
}
