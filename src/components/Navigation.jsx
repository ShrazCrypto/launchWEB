import { Link, useLocation } from 'react-router-dom';

function Navigation() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const isTokenPage = location.pathname.startsWith('/token/');

  // Don't render navigation on token pages for fullscreen experience
  if (isTokenPage) {
    return null;
  }

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="logo">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <h2>Creatok</h2>
          </Link>
        </div>
        <div className="nav-links">
          <Link to="/">Home</Link>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
