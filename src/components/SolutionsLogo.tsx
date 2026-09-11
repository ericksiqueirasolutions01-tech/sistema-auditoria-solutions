import React from 'react';
import logoImg from '../assets/logo-solutions.png';

interface SolutionsLogoProps {
  className?: string;
  height?: number;
  showText?: boolean;
}

export const SolutionsLogo: React.FC<SolutionsLogoProps> = ({
  className = '',
  height = 36,
  showText = true,
}) => {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <img
        src={logoImg}
        alt="Grupo Solutions"
        style={{ height: `${height}px` }}
        className="object-contain w-auto drop-shadow-xs"
        onError={(e) => {
          // Fallback if image fails to render
          e.currentTarget.style.display = 'none';
        }}
      />
      {showText && (
        <div className="flex flex-col">
          <span className="font-extrabold tracking-wider text-slate-800 text-sm leading-tight uppercase font-sans">
            GRUPO SOLUTIONS
          </span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none">
            Auditoria & Qualidade
          </span>
        </div>
      )}
    </div>
  );
};

