import React from 'react';
import { Outlet } from 'react-router-dom';

export function HospitalLayout() {
  return (
    <div className="hospital-layout">
      <Outlet />
    </div>
  );
}
