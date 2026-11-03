export function OrbitPlaceholder() {
  return (
    <svg className="orbit-static" viewBox="0 0 300 240" aria-hidden="true">
      <g fill="none" stroke="#38c6b4" strokeWidth="1.5" opacity=".6">
        <ellipse cx="150" cy="120" rx="104" ry="45" transform="rotate(-32 150 120)" />
        <ellipse cx="150" cy="120" rx="104" ry="45" transform="rotate(34 150 120)" />
        <circle cx="150" cy="120" r="70" />
      </g>
      <circle cx="150" cy="120" r="39" fill="#147d78" />
      <path d="M143 99h14v14h14v14h-14v14h-14v-14h-14v-14h14z" fill="#dff7f4" />
    </svg>
  );
}
