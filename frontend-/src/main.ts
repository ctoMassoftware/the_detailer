import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// BUILD_VERSION: 2026-08-28T16:45:00Z-BACKEND-FIX-DEPLOY
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
