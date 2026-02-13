import { motion } from 'framer-motion';

interface FoodRescueLogoProps {
  size?: number;
  animated?: boolean;
}

const FoodRescueLogo = ({ size = 50, animated = true }: FoodRescueLogoProps) => {
  const coreSize = size * 0.4;
  const ring1Size = size * 0.8;
  const ring2Size = size;

  return (
    <div
      className="logo-icon-modern"
      style={{ width: size, height: size }}
    >
      <div
        className="logo-core"
        style={{
          width: coreSize,
          height: coreSize,
          background: 'linear-gradient(135deg, #10b981, #34d399)',
          borderRadius: '50%',
          boxShadow: '0 0 30px rgba(16, 185, 129, 0.8)',
          position: 'absolute',
        }}
      />
      <motion.div
        className="logo-ring"
        style={{
          width: ring1Size,
          height: ring1Size,
          border: '3px solid transparent',
          borderTopColor: '#10b981',
          borderRightColor: '#34d399',
          borderRadius: '50%',
          position: 'absolute',
        }}
        animate={animated ? { rotate: 360 } : undefined}
        transition={animated ? { duration: 3, repeat: Infinity, ease: 'linear' } : undefined}
      />
      <motion.div
        className="logo-ring ring-2"
        style={{
          width: ring2Size,
          height: ring2Size,
          border: '3px solid transparent',
          borderTopColor: '#6ee7b7',
          borderRightColor: '#a7f3d0',
          borderRadius: '50%',
          position: 'absolute',
        }}
        animate={animated ? { rotate: -360 } : undefined}
        transition={animated ? { duration: 4, repeat: Infinity, ease: 'linear' } : undefined}
      />
    </div>
  );
};

export default FoodRescueLogo;
