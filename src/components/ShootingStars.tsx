import DarkVeil from "./DarkVeil";

const ShootingStars = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0, transform: "translateY(0)" }}>
      <DarkVeil />
    </div>
  );
};

export default ShootingStars;
