import React from "react";

import "./ProfileCard.css";

export type ProfileCardProps = React.HTMLAttributes<HTMLDivElement>;

const ProfileCard = ({ children, className = "", ...rest }: ProfileCardProps) => (
  <div className={`profile-card${className ? ` ${className}` : ""}`} {...rest}>
    {children}
  </div>
);

export default ProfileCard;
