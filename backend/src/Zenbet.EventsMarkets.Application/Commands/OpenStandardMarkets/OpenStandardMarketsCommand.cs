namespace Zenbet.EventsMarkets.Application.Commands.OpenStandardMarkets;

using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Pricing;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;
using EventId = Zenbet.EventsMarkets.Domain.ValueObjects.EventId;

/// <summary>
/// Abre los mercados estándar (ganador, método, total de asaltos, ¿llega a decisión?) de un combate de MMA, SIN cuotas.
/// Idempotente por naturaleza: un tipo que ya existe (en cualquier estado) no se toca. Los mercados nuevos no se publican
/// ni admiten apuestas hasta que el trader los cotice con PriceMarket.
/// </summary>
public sealed record OpenStandardMarketsCommand(EventId EventId, string OpenedBy) : IRequest<OpenStandardMarketsResult>;

public sealed record OpenStandardMarketsResult(
    Guid EventId,
    IReadOnlyList<OpenedMarket> Created,
    IReadOnlyList<string> AlreadyPresent);

public sealed record OpenedMarket(Guid MarketId, string Type, string Name, decimal? Line, IReadOnlyList<OpenedSelection> Selections);

public sealed record OpenedSelection(Guid SelectionId, string Code, string Name);

/// <summary>Abre los mercados estándar de todos los combates de MMA programados en los próximos días.</summary>
public sealed record OpenStandardMarketsForUpcomingCommand(int HorizonDays, string OpenedBy)
    : IRequest<OpenStandardMarketsForUpcomingResult>;

public sealed record OpenStandardMarketsForUpcomingResult(
    int EventsScanned,
    int EventsWithNewMarkets,
    int MarketsCreated,
    IReadOnlyList<OpenStandardMarketsFailure> Skipped);

public sealed record OpenStandardMarketsFailure(Guid EventId, string EventName, string Reason);

public sealed class OpenStandardMarketsCommandHandler : IRequestHandler<OpenStandardMarketsCommand, OpenStandardMarketsResult>
{
    private readonly IEventRepository _eventRepository;
    private readonly IMarketRepository _marketRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<OpenStandardMarketsCommandHandler> _logger;
    private readonly TimeProvider _clock;

    public OpenStandardMarketsCommandHandler(
        IEventRepository eventRepository,
        IMarketRepository marketRepository,
        IUnitOfWork unitOfWork,
        ILogger<OpenStandardMarketsCommandHandler> logger,
        TimeProvider? clock = null)
    {
        _eventRepository = eventRepository;
        _marketRepository = marketRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _clock = clock ?? TimeProvider.System;
    }

    public async Task<OpenStandardMarketsResult> Handle(OpenStandardMarketsCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.OpenedBy))
            throw new ArgumentException("Falta quién abre los mercados.", nameof(request));

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            // Mismo bloqueo de evento que la liquidación: no se abren mercados a mitad de liquidar el combate.
            await _unitOfWork.TryAcquireAdvisoryLockAsync(BitConverter.ToInt64(request.EventId.Value.ToByteArray(), 0), cancellationToken);

            var @event = await _eventRepository.GetByIdAsync(request.EventId, cancellationToken)
                ?? throw new EventNotFoundException(request.EventId);
            var now = _clock.GetUtcNow();

            if (@event.SportType != SportType.MixedMartialArts || @event.Bout is null)
                throw new MarketOpeningRejectedException("El evento no es un combate de MMA con ficha de peleadores.");
            if (@event.Result is not null || @event.Status is not EventStatus.Scheduled)
                throw new MarketOpeningRejectedException($"El combate no está programado (estado {@event.Status}).");
            if (now >= @event.StartTime)
                throw new MarketOpeningRejectedException("El combate ya empezó: no se abren mercados nuevos.");

            var existingMarkets = await _marketRepository.GetByEventIdAsync(request.EventId, cancellationToken);
            // Un mercado anulado (p. ej. por cambio de peleador) no cuenta: se puede volver a abrir limpio.
            var existing = existingMarkets.Where(m => m.Status != MarketStatus.Void).Select(m => m.Type).ToHashSet();
            var created = StandardMmaMarkets.BuildMissing(request.EventId, @event.Bout, existing, request.OpenedBy.Trim(), now);

            foreach (var market in created)
            {
                await _marketRepository.AddAsync(market, cancellationToken);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _unitOfWork.CommitAsync(cancellationToken);

            if (created.Count > 0)
            {
                _logger.LogWarning(
                    "Mercados estándar abiertos sin cotizar en {EventId} por {OpenedBy}: {Count} ({Types}).",
                    request.EventId.Value, request.OpenedBy, created.Count, string.Join(",", created.Select(m => m.Type)));
            }

            return new OpenStandardMarketsResult(
                request.EventId.Value,
                created.Select(m => new OpenedMarket(
                    m.Id.Value,
                    m.Type.ToString(),
                    m.Name,
                    m.Line,
                    m.Selections.OrderBy(s => s.DisplayOrder).Select(s => new OpenedSelection(s.Id.Value, s.Code ?? "", s.Name)).ToList()))
                    .ToList(),
                StandardMmaMarkets.Types.Where(existing.Contains).Select(t => t.ToString()).ToList());
        }
        catch
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }
    }
}

public sealed class OpenStandardMarketsForUpcomingCommandHandler
    : IRequestHandler<OpenStandardMarketsForUpcomingCommand, OpenStandardMarketsForUpcomingResult>
{
    public const int MaxHorizonDays = 60;

    private readonly IEventRepository _eventRepository;
    private readonly ISender _sender;
    private readonly TimeProvider _clock;

    public OpenStandardMarketsForUpcomingCommandHandler(IEventRepository eventRepository, ISender sender, TimeProvider? clock = null)
    {
        _eventRepository = eventRepository;
        _sender = sender;
        _clock = clock ?? TimeProvider.System;
    }

    public async Task<OpenStandardMarketsForUpcomingResult> Handle(
        OpenStandardMarketsForUpcomingCommand request,
        CancellationToken cancellationToken)
    {
        if (request.HorizonDays is < 1 or > MaxHorizonDays)
            throw new MarketOpeningRejectedException($"El horizonte debe estar entre 1 y {MaxHorizonDays} días.");

        var now = _clock.GetUtcNow();
        var events = await _eventRepository.ListAsync(
            EventStatus.Scheduled, SportType.MixedMartialArts, now, now.AddDays(request.HorizonDays), page: 1, pageSize: 500,
            cancellationToken: cancellationToken);

        int withNew = 0, created = 0;
        var skipped = new List<OpenStandardMarketsFailure>();
        foreach (var @event in events.Where(e => e.StartTime > now))
        {
            try
            {
                // Una transacción por combate: un combate problemático no bloquea al resto.
                var result = await _sender.Send(new OpenStandardMarketsCommand(@event.Id, request.OpenedBy), cancellationToken);
                if (result.Created.Count > 0)
                {
                    withNew++;
                    created += result.Created.Count;
                }
            }
            catch (MarketOpeningRejectedException ex)
            {
                skipped.Add(new OpenStandardMarketsFailure(@event.Id.Value, @event.Name, ex.Message));
            }
        }

        return new OpenStandardMarketsForUpcomingResult(events.Count, withNew, created, skipped);
    }
}
