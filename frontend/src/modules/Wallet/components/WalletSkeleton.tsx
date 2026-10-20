const BAR_HEIGHTS = [38, 62, 44, 78, 52, 30, 66] as const;
const METRIC_KEYS = ['en-juego', 'ganancia-neta', 'tasa-acierto', 'apuestas'] as const;
const TABLE_KEYS = ['fila-1', 'fila-2', 'fila-3', 'fila-4'] as const;

function Block({ className = '' }: { readonly className?: string }) {
  return <div className={`animate-pulse rounded-sm bg-obsidian-elevated/60 ${className}`} />;
}

export function WalletSkeleton() {
  return (
    <div role='status' aria-live='polite' className='space-y-4'>
      <span className='sr-only'>Cargando billetera…</span>

      <div className='grid gap-4 lg:grid-cols-12'>
        <div className='glass-panel p-5 sm:p-6 lg:col-span-8'>
          <div className='flex items-center justify-between'>
            <Block className='h-5 w-36' />
            <Block className='h-4 w-20' />
          </div>
          <Block className='mt-8 h-3 w-24' />
          <Block className='mt-3 h-12 w-64' />
          <Block className='mt-4 h-3 w-52' />
          <div className='mt-8 flex flex-col gap-3 border-t border-obsidian-border/60 pt-4 sm:flex-row sm:justify-between'>
            <Block className='h-3 w-60' />
            <div className='flex gap-2'>
              <Block className='h-9 w-32' />
              <Block className='h-9 w-24' />
            </div>
          </div>
        </div>

        <div className='glass-panel p-5 lg:col-span-4'>
          <div className='flex items-center justify-between'>
            <Block className='h-5 w-24' />
            <Block className='h-6 w-16' />
          </div>
          <Block className='mt-5 h-3 w-20' />
          <Block className='mt-2 h-7 w-28' />
          <div className='mt-5 flex h-28 items-end gap-1.5'>
            {BAR_HEIGHTS.map((height) => (
              <div
                key={height}
                className='flex flex-1 flex-col items-center gap-2 animate-pulse'
              >
                <div
                  className='w-full rounded-t-[2px] bg-obsidian-elevated/60'
                  style={{ height: `${height}%` }}
                />
                <div className='h-2 w-5 rounded-sm bg-obsidian-elevated/60' />
              </div>
            ))}
          </div>
          <div className='mt-5 border-t border-obsidian-border/60 pt-4'>
            <Block className='h-3 w-28' />
            <Block className='mt-2 h-1 w-full' />
          </div>
        </div>
      </div>

      <div className='glass-panel grid grid-cols-2 overflow-hidden md:grid-cols-4'>
        {METRIC_KEYS.map((key, index) => (
          <div
            key={key}
            className={`border-obsidian-border/60 p-4 sm:p-5 ${
              index < 2 ? 'border-b md:border-b-0' : ''
            } ${index % 2 === 0 ? 'border-r' : ''} ${
              index === 1 ? 'md:border-r' : ''
            } ${index === 2 ? 'md:border-r' : ''}`}
          >
            <div className='flex items-start justify-between'>
              <Block className='h-3 w-20' />
              <Block className='h-6 w-6' />
            </div>
            <Block className='mt-3 h-6 w-24' />
            <Block className='mt-2 h-3 w-20' />
          </div>
        ))}
      </div>

      <div className='surface-panel p-5 sm:p-6'>
        <div className='flex items-start justify-between'>
          <div>
            <Block className='h-3 w-20' />
            <Block className='mt-2 h-5 w-32' />
            <Block className='mt-2 h-3 w-56' />
          </div>
          <Block className='h-7 w-24' />
        </div>
        <div className='mt-5 border-b border-obsidian-border/60 pb-3'>
          <Block className='h-4 w-72' />
        </div>
        <div className='mt-4 space-y-4'>
          {TABLE_KEYS.map((key) => (
            <div key={key} className='flex items-center gap-4'>
              <Block className='h-10 flex-1' />
              <Block className='h-4 w-12' />
              <Block className='h-4 w-20' />
              <Block className='h-5 w-20' />
            </div>
          ))}
        </div>
      </div>

      <div className='surface-panel p-5 sm:p-6'>
        <div className='flex items-start justify-between'>
          <div>
            <Block className='h-3 w-24' />
            <Block className='mt-2 h-5 w-48' />
            <Block className='mt-2 h-3 w-64' />
          </div>
          <Block className='h-4 w-24' />
        </div>
        <div className='mt-5 border-b border-obsidian-border/60 pb-3'>
          <Block className='h-4 w-80' />
        </div>
        <div className='mt-4 space-y-4'>
          {TABLE_KEYS.map((key) => (
            <div key={key} className='flex items-center gap-4'>
              <Block className='h-8 w-8' />
              <Block className='h-10 flex-1' />
              <Block className='h-4 w-20' />
              <Block className='h-5 w-20' />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
