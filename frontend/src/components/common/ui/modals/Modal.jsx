export default function Modal({ open = false, onClose, children }) {
  if (!open) return null;
  return (
    <div className='modal__overlay' onClick={onClose}>
      <div className='modal' onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
