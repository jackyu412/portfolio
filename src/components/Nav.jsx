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
        <a href="/">Home</a>
        <a href="/research">Research</a>
        <a href="/resume">Résumé/CV</a>
        <a href="/contact">Contact Me</a>
        <a href="/creative">Side Quests🎹📷</a>
      </div>
    </nav>
  );
}