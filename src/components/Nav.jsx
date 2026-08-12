import React, { useState } from 'react';

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="nav">
      <button
        className="nav-toggle"
        aria-label="Toggle navigation menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="nav-toggle-bar" />
        <span className="nav-toggle-bar" />
        <span className="nav-toggle-bar" />
      </button>
      <div className={`nav-links${open ? ' open' : ''}`}>
        <a href="/">About</a>
        <a href="/research">Research</a>
        <a href="/resume">Resume</a>
        <a href="/contact">Contact</a>
        <a href="/creative">Creative</a>
        {/* LinkedIn link */}
        <a
          href="https://www.linkedin.com/in/jack-s-yu"
          target="_blank"
          rel="noopener noreferrer"
          className="icon-link"
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#0A66C2' }} // LinkedIn blue
        >
          <svg height="16" width="16" viewBox="0 0 448 512" fill="#0A66C2">
            <path d="M100.28 448H7.4V148.9h92.88zm-46.44-340a53.75 53.75 0 1 1 53.76-53.76 53.76 53.76 0 0 1-53.76 53.76zm394.34 340h-92.68V302.4c0-34.7-.7-79.2-48.3-79.2-48.3 0-55.7 37.7-55.7 76.7V448h-92.78V148.9h89.1v40.8h1.3c12.4-23.5 42.7-48.3 87.9-48.3 94 0 111.4 61.9 111.4 142.3V448z"/>
          </svg>
        </a>
      </div>
    </nav>
  );
}
