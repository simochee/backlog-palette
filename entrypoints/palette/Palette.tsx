/*
 * M5 までの暫定。components/ の部品は使わず、入力欄 1 つだけを置く。
 * ホストとの通信路を通し、E2E の完了条件を検査するための最小構成。
 */
export function Palette() {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'start center' }}>
      <input aria-label="Backlog Palette" style={{ marginTop: '15vh', width: 640 }} />
    </div>
  );
}
