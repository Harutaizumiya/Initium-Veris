import React from "react";

interface LocationBadgeProps {
  location: string;
}

export const LocationBadge: React.FC<LocationBadgeProps> = ({ location }) => (
  <span className="px-2 py-1 bg-surface-container text-[10px] font-bold rounded text-on-surface-variant">
    {location}
  </span>
);
