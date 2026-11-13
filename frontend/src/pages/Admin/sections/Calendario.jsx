import Calendario from '../../../components/Calendario/Calendario'
import { PageHeader } from '../components/AdminUI'

function AdminCalendario() {
  return (
    <div>
      <PageHeader
        title="Calendario"
        subtitle="Reservas, partidos y torneos del club. Las reservas con borde punteado aún no están pagadas."
      />
      <Calendario admin />
    </div>
  )
}

export default AdminCalendario
