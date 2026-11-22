export function StarButton({ starred, title, onToggle }: {
  starred: boolean;
  title: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      class={starred ? 'star-btn starred' : 'star-btn'}
      aria-pressed={starred}
      aria-label={starred ? `Poista tähti: ${title}` : `Merkitse tähdellä: ${title}`}
      onClick={onToggle}
    >
      <span aria-hidden="true">{starred ? '★' : '☆'}</span>
    </button>
  );
}
