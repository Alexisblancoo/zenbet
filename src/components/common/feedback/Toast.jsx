import { useState } from 'react';

export default function Toast({ message, open = true, onClose }) {
  if (!open) return null;
  return (
    <div className='toast'>
      <span className='toast__message'>{message}</span>
      <button className='toast__close' onClick={onClose}>×</button>
    </div>
  );
}
