import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { IDIOMA_POR_DEFECTO, detectarIdiomaInicial } from './nucleo/idioma.servicio';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Cada pantalla empieza por arriba.
    //
    // Angular, por defecto, **no toca el desplazamiento al cambiar de ruta**: la pantalla
    // nueva se monta con el scroll donde lo dejó la anterior. Eso se notaba al entrar en
    // «Acerca de», que es la última entrada del menú: para tocarla hay que bajar, y la ficha
    // aparecía ya desplazada hasta el final, con el texto empezado. Con `enabled`, una
    // navegación nueva sube arriba y el botón de atrás devuelve a cada pantalla el sitio por
    // el que iba —que es lo que hace falta al volver al mapa de niveles del Modo Historia.
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
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
