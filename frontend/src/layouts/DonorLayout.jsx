import React from 'react';
import { Outlet } from 'react-router-dom';

export function DonorLayout() {
  return (
    <div className="donor-layout">
      <Outlet />
    </div>
  );
}
