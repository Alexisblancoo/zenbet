export default function DataTable({ columns, data }) {
  return (
    <div className='data-table'>
      <table className='data-table__table'>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className='data-table__cell'>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} className='data-table__row'>
              {columns.map((col) => (
                <td key={col.key} className='data-table__cell'>{row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
