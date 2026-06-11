import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/config", label: "Dashboard", end: true },
  { to: "/config/teams", label: "Teams" },
  { to: "/config/matches", label: "Matches" },
  { to: "/config/schedule", label: "Schedule" },
  { to: "/config/bracket", label: "Bracket" },
  { to: "/config/draft", label: "Draft" },
  { to: "/config/heroes", label: "Heroes" },
  { to: "/config/maps", label: "Maps" },
  { to: "/config/casters", label: "Casters" },
  { to: "/config/overlay-controls", label: "Overlay Controls" },
  { to: "/config/overlays", label: "Overlays" },
  { to: "/config/standings", label: "Standings" },
];

function ControllerTopNav() {
  return (
    <header className="controller-topnav">
      <div className="controller-topnav-inner">
        <NavLink to="/config" end className="controller-brand">
          <img
            src="/jeiziproductions.png"
            alt="Jeizi Productions"
            className="controller-brand-logo"
          />
          <span>Jeizi Controller</span>
        </NavLink>

        <nav className="controller-nav-links" aria-label="Controller navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `controller-nav-link${isActive ? " is-active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default ControllerTopNav;
