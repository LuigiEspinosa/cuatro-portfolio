'use client';

import { useEffect } from 'react';
import './celeste.scss';

export default function CelesteComponent() {
  useEffect(() => {
    const header = document.querySelector('header');
    if (header) header.style.display = 'none';

    return () => {
      if (header) header.style.display = 'block';
    };
  }, []);

  return <h1> Te amo muchísimo hermosa 💙🦋</h1>;
}

