import React from 'react';
import { Outlet } from 'react-router-dom';

export function BloodBankLayout() {
  return (
    <div className="blood-bank-layout">
      <Outlet />
    </div>
  );
}
