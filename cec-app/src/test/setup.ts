/**
 * Preparación común de las pruebas.
 *
 * `@testing-library/jest-dom` sólo aporta matchers de DOM, así que se carga
 * únicamente cuando la prueba corre en jsdom (las del ETL corren en Node).
 */

if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest')

  // Recharts mide su contenedor con ResponsiveContainer; jsdom no hace layout,
  // así que se le da un tamaño fijo para que el gráfico se renderice.
  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub
  }
  for (const prop of ['offsetWidth', 'offsetHeight'] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      value: prop === 'offsetWidth' ? 800 : 400,
    })
  }
}
