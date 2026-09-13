import wxtLogo from '/wxt.svg';
import { useState } from 'react';

import reactLogo from '@/assets/react.svg';
import { Button } from '@/components/atoms/Button';

import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <div>
        <a href="https://wxt.dev" target="_blank" rel="noreferrer">
          <img src={wxtLogo} className="logo" alt="WXT logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>WXT + React</h1>
      <div className="card">
        <Button onClick={() => setCount((prev) => prev + 1)}>count is {count}</Button>
      </div>
    </>
  );
}

export default App;
