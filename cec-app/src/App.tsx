import { HashRouter, Route, Routes } from 'react-router-dom'
import { irASeccion } from './lib/navegacion'
import { AppStore, useApp } from './store/AppStore'
import { NavBar } from './components/NavBar'
import { Resumen } from './pages/Resumen'
import { Semanal } from './pages/Semanal'
import { Tabulacion } from './pages/Tabulacion'
import { Academico } from './pages/Academico'
import { Cursos } from './pages/Cursos'
import { Guia } from './pages/Guia'

/** Aviso discreto cuando la base viene de la semilla publicada, no del equipo. */
function BarraOrigen() {
  const { origen, derivada } = useApp()
  if (origen !== 'semilla' || derivada.programas.length === 0) return null
  return (
    <div className="wrap">
      <p
        className="mt-3 text-[12.5px] text-muted rounded-soft px-4 py-2 border border-line"
        style={{ background: 'var(--card)' }}
        role="status"
      >
        Datos de ejemplo publicados con el sitio ({derivada.programas.length} cursos).
        Sube tus Excel en <b className="text-heading font-semibold">Cursos</b> para trabajar con los tuyos.
      </p>
    </div>
  )
}

function Layout() {
  return (
    <>
      <a
        href="#principal"
        className="skip-link"
        onClick={(e) => {
          // Con HashRouter, dejar que el navegador siga el ancla cambiaría la
          // ruta a «principal» y sacaría al usuario de la página actual.
          e.preventDefault()
          irASeccion('principal')
        }}
      >
        Saltar al contenido
      </a>
      <NavBar />
      <BarraOrigen />
      <main id="principal" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Resumen />} />
          <Route path="/semanal" element={<Semanal />} />
          <Route path="/tabulacion" element={<Tabulacion />} />
          <Route path="/academico" element={<Academico />} />
          <Route path="/cursos" element={<Cursos />} />
          <Route path="/guia" element={<Guia />} />
          <Route path="*" element={<Resumen />} />
        </Routes>
      </main>
      <footer className="wrap py-8 text-center text-[12px] text-muted">
        Centro de Educación Continuada · Universidad del Norte — los datos se procesan y
        guardan en este navegador.
      </footer>
    </>
  )
}

export default function App() {
  return (
    <AppStore>
      <HashRouter>
        <Layout />
      </HashRouter>
    </AppStore>
  )
}
