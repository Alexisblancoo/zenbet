export default function Button({ children, variant = 'primary', onClick, disabled }) {
  return (
    <button className={'btn btn--' + variant} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
