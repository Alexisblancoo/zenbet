import { Search, X } from 'lucide-react';

interface FighterSearchProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly resultCount: number | null;
}

/** Buscador controlado; el filtrado ocurre sobre los eventos reales ya cargados desde la API. */
export default function FighterSearch({ value, onChange, resultCount }: FighterSearchProps) {
  return (
    <div className='flex flex-col gap-1.5'>
      <label className='relative block'>
        <span className='sr-only'>Buscar peleador, división o cartelera</span>
        <Search
          size={14}
          className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-metallic-slate'
          aria-hidden='true'
        />
        <input
          type='search'
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder='Buscar peleador, división o país'
          autoComplete='off'
          className='w-full border border-white/[0.1] bg-white/[0.03] py-2.5 pl-9 pr-9 font-sans text-sm text-white placeholder:text-metallic-slate focus:border-lime-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-lime-400'
        />
        {value && (
          <button
            type='button'
            onClick={() => onChange('')}
            aria-label='Limpiar búsqueda'
            className='absolute right-2 top-1/2 -translate-y-1/2 p-1 text-metallic-slate hover:text-white'
          >
            <X size={14} aria-hidden='true' />
          </button>
        )}
      </label>
      {resultCount !== null && (
        <p className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate' role='status'>
          {resultCount} {resultCount === 1 ? 'combate encontrado' : 'combates encontrados'}
        </p>
      )}
    </div>
  );
}
