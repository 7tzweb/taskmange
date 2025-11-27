import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import 'devextreme/dist/css/dx.light.css';
import App from './App.jsx';

const RootWithLayout = () => {
  useEffect(() => {
    const root = document.documentElement;
    root.lang = 'he';
    root.dir = 'rtl';
  }, []);

  return <App />;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootWithLayout />
  </StrictMode>
);
