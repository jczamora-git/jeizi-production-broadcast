function WinIndicators({
  total,
  score,
  side,
  size = 19,
  gap = 0,
  activeColor = "#ff5e00",
  inactiveColor = "#ffffff",
  strokeColor = "#ffffff",
  className = "",
}) {
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeScore = Math.min(Math.max(Number(score) || 0, 0), safeTotal);
  const items = Array.from({ length: safeTotal }, (_, index) => index < safeScore);
  const direction = side === "blue" ? "row-reverse" : "row";

  return (
    <div
      className={`win-indicators ${className}`.trim()}
      style={{
        display: "flex",
        flexDirection: direction,
        gap: `${gap}px`,
      }}
    >
      {items.map((isActive, index) => (
        <span
          key={`${side}-${index}`}
          className="win-indicator"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: "9999px",
            border: `2px solid ${strokeColor}`,
            backgroundColor: isActive ? activeColor : inactiveColor,
            display: "inline-block",
          }}
        />
      ))}
    </div>
  );
}

export default WinIndicators;
