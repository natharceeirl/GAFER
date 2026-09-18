import type { ReactNode } from 'react';
import type { ColorAura } from '@gafer/contracts';
import { colorAuraToClassName } from './colorAuraToClassName';
import './badge.css';

interface BadgeProps {
  color: ColorAura;
  children: ReactNode;
}

export function Badge({ color, children }: BadgeProps) {
  return <span className={colorAuraToClassName(color)}>{children}</span>;
}
