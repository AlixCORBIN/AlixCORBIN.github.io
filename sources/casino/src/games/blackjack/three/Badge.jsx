import { Html } from "@react-three/drei";

export function Badge({
  position,
  children,
  color = "#fff",
  bg = "rgba(0,0,0,.62)",
  small,
}) {
  return (
    <Html
      position={position}
      center
      zIndexRange={[20, 0]}
      style={{
        pointerEvents: "none",
      }}
    >
      <div
        className="badge"
        style={{
          color,
          background: bg,
          fontSize: small ? 11 : 13,
        }}
      >
        {children}
      </div>
    </Html>
  );
}
