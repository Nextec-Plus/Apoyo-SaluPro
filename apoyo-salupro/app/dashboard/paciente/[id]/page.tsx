import { redirect } from "next/navigation";

export default async function PacienteRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard?tab=pacientes&paciente=${id}`);
}
