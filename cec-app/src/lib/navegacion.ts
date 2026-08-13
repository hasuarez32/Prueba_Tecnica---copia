/**
 * Desplazamiento a una sección dentro de la misma página.
 *
 * Con `HashRouter` el hash de la URL **es la ruta**, así que un `<a href="#x">`
 * no lleva a la sección: el router lo lee como la ruta «x», no la encuentra y
 * cae en la ruta comodín. Por eso la navegación interna se hace por código.
 */

export function irASeccion(id: string): void {
  const destino = document.getElementById(id)
  if (!destino) return

  const suave = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  // `scrollIntoView` no existe en todos los entornos (jsdom, por ejemplo). Si
  // falta, se pierde el desplazamiento pero el foco —lo que de verdad importa
  // para teclado y lectores de pantalla— debe moverse igual.
  destino.scrollIntoView?.({ behavior: suave ? 'smooth' : 'auto', block: 'start' })

  // Mover el foco además de la vista: si sólo se desplaza, quien navega con
  // teclado o lector de pantalla sigue donde estaba. `tabindex="-1"` hace la
  // sección enfocable sin meterla en el orden de tabulación.
  if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1')
  destino.focus({ preventScroll: true })
}
