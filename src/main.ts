import './styles/app.css';
import { createAppShell } from './ui/createAppShell.ts';
import { installViewportLayout } from './ui/installViewportLayout.ts';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Unable to find #app root element.');
}

installViewportLayout();
void createAppShell(root);
