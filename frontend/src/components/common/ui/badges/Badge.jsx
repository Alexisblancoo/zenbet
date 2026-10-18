export default function Badge({ variant = 'default', className = '', children }) {
  const classes = ['badge', `badge--${variant}`, className].filter(Boolean).join(' ');
  return <span className={classes}>{children}</span>;
}
