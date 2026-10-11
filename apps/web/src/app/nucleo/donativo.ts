/**
 * El enlace del donativo, el que se ofrece en «Acerca de».
 *
 * Vive aqui y no en el motor porque no es logica de juego: el motor es el
 * buscaminas y nada mas. El panel del servidor lleva su propia copia de esta
 * direccion, por lo mismo que lleva copiado el icono — la imagen de la Fase 9
 * no arrastra la web para pintar su pagina—, asi que si cambia hay que cambiar
 * los dos sitios.
 *
 * Es opcional de principio a fin: no desbloquea nada, no quita anuncios (no
 * hay) y el juego no lo menciona en ninguna otra pantalla.
 */
export const URL_DONATIVO = 'https://paypal.me/jbautistamartin';
