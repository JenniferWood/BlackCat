export function LoadingSpinner({ text }: { text?: string }) {
  return (
    <div className="spinner-overlay">
      <div className="spinner-container">
        <div className="spinner" />
        {text && <div className="spinner-text">{text}</div>}
      </div>
    </div>
  );
}
