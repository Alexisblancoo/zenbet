export default function FormField({ label, name, type = 'text', value, onChange, required = false }) {
  return (
    <div className='form-field'>
      <label className='form-field__label'>{label}{required && ' *'}</label>
      <input
        className='form-field__input'
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
      />
    </div>
  );
}
