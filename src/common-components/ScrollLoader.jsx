import React from "react";
import { ImSpinner2 } from "react-icons/im";

const ScrollLoader = React.memo(() => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '15px 0' }}>
    <ImSpinner2 style={{ fontSize: '36px', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
  </div>
));

ScrollLoader.displayName = "ScrollLoader";

export default ScrollLoader;
