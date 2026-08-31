import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { IDIOMA_POR_DEFECTO, detectarIdiomaInicial } from './nucleo/idioma.servicio';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // Los textos se cargan de assets/i18n/<idioma>.json en caliente, sin
    // recompilar, que es justo lo que el i18n nativo de Angular no permite.
    provideTranslateService({
      lang: detectarIdiomaInicial(),
      fallbackLang: IDIOMA_POR_DEFECTO,
      loader: provideTranslateHttpLoader({
        prefix: './assets/i18n/',
        suffix: '.json',
      }),
    }),
  ],
};
