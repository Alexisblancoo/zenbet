export default function Input({ id, label, type = 'text', value, onChange, placeholder }) {
  return (
    <div className='input-wrapper'>
      {label && <label className='input__label' htmlFor={id}>{label}</label>}
      <input
        id={id}
        className='input__field'
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}
