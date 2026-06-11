import { Outlet } from "react-router-dom";
import MatchAccessBar from "./MatchAccessBar.jsx";
import ControllerTopNav from "./ControllerTopNav.jsx";

function ControllerLayout() {
  return (
    <>
      <MatchAccessBar />
      <ControllerTopNav />
      <main className="controller-shell">
        <Outlet />
      </main>
    </>
  );
}

export default ControllerLayout;
