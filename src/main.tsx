import { createRoot } from 'react-dom/client';
import App from './App';
import './ui/ui.css';

// No StrictMode: it would mount the Phaser game twice in development.
createRoot(document.getElementById('root')!).render(<App />);
