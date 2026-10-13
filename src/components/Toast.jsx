// toast = { title, text, visible }；內容在淡出時保留，避免文字先消失。
export default function Toast({ toast }) {
  return (
    <div className={`toast${toast?.visible ? ' is-show' : ''}`} role="status" aria-live="polite">
      <b>{toast?.title}</b>
      <p>{toast?.text}</p>
    </div>
  );
}
