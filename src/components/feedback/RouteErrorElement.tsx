import { useRouteError } from 'react-router'
import { LoadErrorScreen } from './LoadErrorScreen'

/** errorElement del enrutador: sustituye la pantalla técnica de React Router. */
export function RouteErrorElement() {
  const error = useRouteError()
  console.error(error) // Solo en la consola, para diagnóstico; nunca en la interfaz.
  return <LoadErrorScreen error={error} />
}
