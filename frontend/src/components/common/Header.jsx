import React from 'react';
import { TopHeader } from './TopHeader.jsx';

export function Header({ onToggleMobileMenu }) {
  return <TopHeader onToggleMobileMenu={onToggleMobileMenu} />;
}
