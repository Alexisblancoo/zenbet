export function adaptOdds(rawOdds) {
  return rawOdds.map((odd) => ({
    id: odd.id,
    sport: odd.sport,
    market: odd.market,
    odd: Number(odd.odd),
    updatedAt: new Date(odd.updated_at),
  }));
}
