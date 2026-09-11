import React from 'react';
import samsungLogoImg from '../assets/logo-samsung.png';

interface SamsungLogoProps {
  className?: string;
  variant?: 'blue' | 'white' | 'black';
  height?: number;
}

export const SamsungLogo: React.FC<SamsungLogoProps> = ({
  className = '',
  height = 24,
}) => {
  return (
    <img
      src={samsungLogoImg}
      alt="Samsung"
      style={{ height: `${height}px` }}
      className={`inline-block object-contain w-auto select-none ${className}`}
    />
  );
};


