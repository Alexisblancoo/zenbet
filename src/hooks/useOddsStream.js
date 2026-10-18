import { useEffect, useState } from 'react';

export function useOddsStream(sportId) {
  const [odds, setOdds] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const interval = setInterval(() => {
      setOdds((prev) => ({ ...prev, [sportId]: Math.random().toFixed(2) }));
    }, 3000);
    return () => clearInterval(interval);
  }, [sportId]);

  return { odds, loading };
}
