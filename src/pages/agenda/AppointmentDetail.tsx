import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  agendaErrorMessage,
  setAppointmentStatus,
  type AgendaItem,
} from "@/data/agenda";
import {
  capitalize,
  confirmWhatsappUrl,
  kindLabel,
  longDayLabel,
  STATUS,
  zonedParts,
  type AppointmentStatus,
} from "@/lib/agenda";

type Props = {
  item: AgendaItem;
  tz: string;
  clinicName: string;
  canWrite: boolean;
  /** Gerencia y recepción: pueden abrir el lead y convertirlo. */
  canSeeLeads?: boolean;
  onChanged: () => void;
  onClose: () => void;
};

/** P10 · Detalle de la cita: estados, confirmación por WhatsApp, reagendar y cancelar. */
export function AppointmentDetail({
  item: a,
  tz,
  clinicName,
  canWrite,
  canSeeLeads = false,
  onChanged,
  onClose,
}: Props) {
  const [busy, setBusy] = useState<AppointmentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const start = zonedParts(new Date(a.starts_at), tz);
  const end = zonedParts(new Date(a.ends_at), tz);
  const open = a.status === "programada" || a.status === "confirmada";
  // Hora de referencia fija al abrir el panel (el panel se vuelve a montar al cambiar de cita).
  const [now] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement>(null);
  // Sin columna lateral (menos de 1280 px) el panel queda abajo: llevarlo a la vista.
  useEffect(() => {
    if (window.matchMedia?.("(max-width: 1279px)").matches)
      ref.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }, []);
  const started = new Date(a.starts_at).getTime() - now <= 2 * 60 * 60 * 1000;

  const change = async (status: AppointmentStatus, why?: string) => {
    setBusy(status);
    setError(null);
    try {
      await setAppointmentStatus(a.id, status, why);
      setCancelling(false);
      onChanged();
    } catch (e) {
      setError(agendaErrorMessage(e as { code?: string; message?: string }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={ref} className="scroll-mt-24">
      <Card
        as="section"
        aria-labelledby="cita-titulo"
        className="flex flex-col gap-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <span>
              <Badge tone={STATUS[a.status].badge}>
                {STATUS[a.status].label}
              </Badge>
              {a.lead_id && (
                <Badge tone="violet" className="ml-1.5">
                  Paciente nuevo
                </Badge>
              )}
            </span>
            <h2 id="cita-titulo" className="m-0 text-subtitle">
              {a.patient_name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 text-ui font-semibold text-violet"
          >
            Cerrar
          </button>
        </div>

        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ui">
          <dt className="text-ink-muted">Cuándo</dt>
          <dd className="m-0">
            {capitalize(longDayLabel(start.date))}, {start.time}–{end.time}
          </dd>
          <dt className="text-ink-muted">Doctor</dt>
          <dd className="m-0">{a.doctor_name || "Sin nombre"}</dd>
          <dt className="text-ink-muted">Lugar</dt>
          <dd className="m-0">
            {a.branch_name} · {a.chair_name}
          </dd>
          <dt className="text-ink-muted">Motivo</dt>
          <dd className="m-0">
            {kindLabel(a.kind)}
            {a.treatment_name ? ` · ${a.treatment_name}` : ""}
          </dd>
          {a.notes && (
            <>
              <dt className="text-ink-muted">Notas</dt>
              <dd className="m-0 whitespace-pre-line">{a.notes}</dd>
            </>
          )}
          {a.cancel_reason && (
            <>
              <dt className="text-ink-muted">Motivo de cancelación</dt>
              <dd className="m-0">{a.cancel_reason}</dd>
            </>
          )}
        </dl>

        {error && <Alert tone="error">{error}</Alert>}

        {canWrite && open && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {started ? (
                <>
                  <Button
                    size="sm"
                    loading={busy === "llego"}
                    onClick={() => void change("llego")}
                  >
                    Llegó
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === "no_asistio"}
                    onClick={() => void change("no_asistio")}
                  >
                    No asistió
                  </Button>
                </>
              ) : (
                a.status === "programada" && (
                  <Button
                    size="sm"
                    loading={busy === "confirmada"}
                    onClick={() => void change("confirmada")}
                  >
                    Marcar confirmada
                  </Button>
                )
              )}
              <Link
                to={`/agenda/${a.id}/editar`}
                className={buttonClasses("secondary", "sm")}
              >
                Reagendar
              </Link>
            </div>
            {a.status === "programada" && !started && a.patient_phone && (
              <a
                href={confirmWhatsappUrl(a.patient_phone, {
                  patient: a.patient_name,
                  clinic: clinicName,
                  date: start.date,
                  time: start.time,
                })}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses("ghost", "sm", "self-start")}
              >
                Confirmar por WhatsApp
              </a>
            )}
            {!cancelling ? (
              <button
                type="button"
                onClick={() => setCancelling(true)}
                className="min-h-11 self-start text-ui font-semibold text-error"
              >
                Cancelar cita
              </button>
            ) : (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <Input
                  label="Motivo (opcional)"
                  value={reason}
                  maxLength={300}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej. El paciente avisó que no puede."
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === "cancelada"}
                    onClick={() => void change("cancelada", reason)}
                  >
                    Sí, cancelar la cita
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCancelling(false)}
                  >
                    No
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {canWrite && (a.status === "llego" || a.status === "no_asistio") && (
          <button
            type="button"
            onClick={() =>
              void change(a.status === "llego" ? "no_asistio" : "llego")
            }
            className="min-h-11 self-start text-ui font-semibold text-violet"
          >
            {a.status === "llego"
              ? "Corregir: no asistió"
              : "Corregir: sí llegó"}
          </button>
        )}

        {a.patient_id ? (
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/pacientes/${a.patient_id}`}
              className={buttonClasses("ghost", "md")}
            >
              Abrir ficha del paciente
            </Link>
            {canSeeLeads && canWrite && (
              <Link
                to={`/cobros/nuevo?paciente=${a.patient_id}`}
                className={buttonClasses("secondary", "md")}
              >
                Registrar cobro
              </Link>
            )}
          </div>
        ) : a.lead_id && canSeeLeads ? (
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/leads/${a.lead_id}/convertir`}
              className={buttonClasses("secondary", "md")}
            >
              Convertir en paciente
            </Link>
            <Link
              to={`/leads/${a.lead_id}`}
              className={buttonClasses("ghost", "md")}
            >
              Abrir lead
            </Link>
          </div>
        ) : (
          <p className="m-0 text-caption text-ink-muted">
            Aún no es paciente: recepción lo registra cuando llegue.
          </p>
        )}
      </Card>
    </div>
  );
}
