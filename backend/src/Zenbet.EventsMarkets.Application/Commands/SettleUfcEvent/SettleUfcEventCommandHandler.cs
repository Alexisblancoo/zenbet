namespace Zenbet.EventsMarkets.Application.Commands.SettleUfcEvent;

using System.Security.Cryptography;
using System.Text;
using MediatR;
using Microsoft.Extensions.Logging;
using Zenbet.EventsMarkets.Application.Commands.SettleMarket;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Domain.Aggregates;
using Zenbet.EventsMarkets.Domain.Enums;
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Domain.Repositories;
using Zenbet.EventsMarkets.Domain.ValueObjects;

/// <summary>
/// Ingesta el resultado oficial de un combate y liquida, mercado por mercado,
/// todas las familias publicadas. El resultado queda persistido en el evento y
/// el PayoutWorker se encarga de pagar las apuestas en segundo plano.
/// </summary>
public sealed class SettleUfcEventCommandHandler
    : IRequestHandler<SettleUfcEventCommand, SettleUfcEventResult>
{
    private readonly IEventRepository _eventRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMediator _mediator;
    private readonly ILogger<SettleUfcEventCommandHandler> _logger;

    public SettleUfcEventCommandHandler(
        IEventRepository eventRepository,
        IUnitOfWork unitOfWork,
        IMediator mediator,
        ILogger<SettleUfcEventCommandHandler> logger)
    {
        _eventRepository = eventRepository;
        _unitOfWork = unitOfWork;
        _mediator = mediator;
        _logger = logger;
    }

    public async Task<SettleUfcEventResult> Handle(
        SettleUfcEventCommand request,
        CancellationToken cancellationToken)
    {
        var @event = await _eventRepository.GetByIdWithDetailsAsync(request.EventId, cancellationToken)
            ?? throw new EventNotFoundException(request.EventId);

        if (@event.SportType != SportType.MixedMartialArts || @event.Bout is null)
            throw new InvalidOperationException("El evento no es un combate de MMA con ficha de peleadores.");

        if (request.Round < 1 || request.Round > @event.Bout.ScheduledRounds)
            throw new ArgumentOutOfRangeException(
                nameof(request.Round),
                $"El asalto debe estar entre 1 y {@event.Bout.ScheduledRounds}.");

        if (request.Method == MmaVictoryMethod.Decision &&
            request.Round != @event.Bout.ScheduledRounds)
            throw new ArgumentException(
                "Una decisión debe registrarse en el último asalto programado.",
                nameof(request.Round));

        var alreadyRecorded = @event.Result is not null &&
            @event.Result.Matches(request.WinnerCorner, request.Method, request.Round);

        if (@event.Result is null)
        {
            var result = MmaResult.Create(
                request.WinnerCorner,
                request.Method,
                request.Round,
                DateTimeOffset.UtcNow);

            // Se actualiza una instancia sin mercados para no marcar como
            // modificado el grafo completo de cuotas y selecciones.
            var eventForUpdate = await _eventRepository.GetByIdAsync(request.EventId, cancellationToken)
                ?? throw new EventNotFoundException(request.EventId);

            var expectedVersion = eventForUpdate.Version;
            eventForUpdate.RecordResult(result);

            await _eventRepository.UpdateAsync(eventForUpdate, expectedVersion, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Resultado UFC registrado para {EventId}: {Corner} por {Method} en R{Round}.",
                request.EventId,
                request.WinnerCorner,
                request.Method,
                request.Round);
        }
        else if (!alreadyRecorded)
        {
            throw new InvalidOperationException(
                "El evento ya tiene un resultado oficial distinto. No se puede reescribir.");
        }

        var marketResults = new List<UfcMarketSettlementResult>(@event.Markets.Count);

        foreach (var market in @event.Markets)
        {
            if (market.Status == MarketStatus.Settled)
            {
                marketResults.Add(new UfcMarketSettlementResult(
                    market.Id.Value,
                    market.Type.ToString(),
                    market.WinnerSelectionId?.Value,
                    market.Status.ToString()));
                continue;
            }

            if (market.Status == MarketStatus.Void)
            {
                marketResults.Add(new UfcMarketSettlementResult(
                    market.Id.Value,
                    market.Type.ToString(),
                    null,
                    market.Status.ToString()));
                continue;
            }

            var winner = UfcMarketResultResolver.ResolveWinner(
                market,
                request.WinnerCorner,
                request.Method,
                request.Round);

            if (winner is null)
            {
                throw new InvalidOperationException(
                    $"No se pudo resolver el ganador del mercado {market.Name} ({market.Type}). " +
                    "Revisa la línea y los códigos de selección.");
            }

            var idempotencyKey = DeterministicGuid($"ufc-result:{request.EventId}:{market.Id}");

            var settled = await _mediator.Send(
                new SettleMarketCommand(
                    market.Id,
                    winner.Id,
                    SettlementResult.Won,
                    request.SettledBy,
                    idempotencyKey),
                cancellationToken);

            marketResults.Add(new UfcMarketSettlementResult(
                settled.MarketId.Value,
                market.Type.ToString(),
                settled.WinnerSelectionId.Value,
                settled.Result.ToString()));
        }

        var current = await _eventRepository.GetByIdAsync(request.EventId, cancellationToken);

        return new SettleUfcEventResult(
            request.EventId.Value,
            @event.Name,
            request.WinnerCorner == FightCorner.Red ? "red" : "blue",
            request.Method.ToString(),
            request.Round,
            (current?.Status ?? EventStatus.Finished).ToString(),
            alreadyRecorded,
            marketResults);
    }

    private static Guid DeterministicGuid(string value)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return new Guid(hash.AsSpan(0, 16));
    }
}
