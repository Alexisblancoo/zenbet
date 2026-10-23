namespace Zenbet.EventsMarkets.Application.Queries.GetFighterComparison;

using MediatR;
using Zenbet.EventsMarkets.Application.DTOs;

/// <summary>
/// Comparativa de las dos esquinas de un combate. El evento es la fuente de
/// verdad: evita emparejar peleadores de carteleras distintas por accidente.
/// </summary>
public sealed record GetFighterComparisonQuery(Guid EventId) : IRequest<FighterComparisonDto?>;
