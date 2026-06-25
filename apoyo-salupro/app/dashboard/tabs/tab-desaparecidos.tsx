"use client";

import { useState } from "react";

const SECTORES = [
  "Maiquetía", "Caraballeda", "Macuto", "La Guaira",
  "Naiguatá", "Caruao", "Tanaguarena", "Otro",
];

const PAISES = [
  { code: "+1",    label: "Estados Unidos (+1)" },
  { code: "+1-242",label: "Bahamas (+1-242)" },
  { code: "+1-246",label: "Barbados (+1-246)" },
  { code: "+1-268",label: "Antigua y Barbuda (+1-268)" },
  { code: "+1-284",label: "Islas Vírgenes Británicas (+1-284)" },
  { code: "+1-345",label: "Islas Caimán (+1-345)" },
  { code: "+1-441",label: "Bermudas (+1-441)" },
  { code: "+1-473",label: "Granada (+1-473)" },
  { code: "+1-649",label: "Islas Turcas y Caicos (+1-649)" },
  { code: "+1-664",label: "Montserrat (+1-664)" },
  { code: "+1-670",label: "Islas Marianas del Norte (+1-670)" },
  { code: "+1-671",label: "Guam (+1-671)" },
  { code: "+1-684",label: "Samoa Americana (+1-684)" },
  { code: "+1-721",label: "San Martín (+1-721)" },
  { code: "+1-758",label: "Santa Lucía (+1-758)" },
  { code: "+1-767",label: "Dominica (+1-767)" },
  { code: "+1-784",label: "San Vicente y Granadinas (+1-784)" },
  { code: "+1-787",label: "Puerto Rico (+1-787)" },
  { code: "+1-809",label: "República Dominicana (+1-809)" },
  { code: "+1-829",label: "República Dominicana (+1-829)" },
  { code: "+1-849",label: "República Dominicana (+1-849)" },
  { code: "+1-868",label: "Trinidad y Tobago (+1-868)" },
  { code: "+1-869",label: "San Cristóbal y Nieves (+1-869)" },
  { code: "+1-876",label: "Jamaica (+1-876)" },
  { code: "+1-939",label: "Puerto Rico (+1-939)" },
  { code: "+20",   label: "Egipto (+20)" },
  { code: "+212",  label: "Marruecos (+212)" },
  { code: "+213",  label: "Argelia (+213)" },
  { code: "+216",  label: "Túnez (+216)" },
  { code: "+218",  label: "Libia (+218)" },
  { code: "+220",  label: "Gambia (+220)" },
  { code: "+221",  label: "Senegal (+221)" },
  { code: "+222",  label: "Mauritania (+222)" },
  { code: "+223",  label: "Malí (+223)" },
  { code: "+224",  label: "Guinea (+224)" },
  { code: "+225",  label: "Costa de Marfil (+225)" },
  { code: "+226",  label: "Burkina Faso (+226)" },
  { code: "+227",  label: "Níger (+227)" },
  { code: "+228",  label: "Togo (+228)" },
  { code: "+229",  label: "Benín (+229)" },
  { code: "+230",  label: "Mauricio (+230)" },
  { code: "+231",  label: "Liberia (+231)" },
  { code: "+232",  label: "Sierra Leona (+232)" },
  { code: "+233",  label: "Ghana (+233)" },
  { code: "+234",  label: "Nigeria (+234)" },
  { code: "+235",  label: "Chad (+235)" },
  { code: "+236",  label: "República Centroafricana (+236)" },
  { code: "+237",  label: "Camerún (+237)" },
  { code: "+238",  label: "Cabo Verde (+238)" },
  { code: "+239",  label: "Santo Tomé y Príncipe (+239)" },
  { code: "+240",  label: "Guinea Ecuatorial (+240)" },
  { code: "+241",  label: "Gabón (+241)" },
  { code: "+242",  label: "Congo (+242)" },
  { code: "+243",  label: "República Democrática del Congo (+243)" },
  { code: "+244",  label: "Angola (+244)" },
  { code: "+245",  label: "Guinea-Bisáu (+245)" },
  { code: "+246",  label: "Territorio Británico del Océano Índico (+246)" },
  { code: "+247",  label: "Ascensión (+247)" },
  { code: "+248",  label: "Seychelles (+248)" },
  { code: "+249",  label: "Sudán (+249)" },
  { code: "+250",  label: "Ruanda (+250)" },
  { code: "+251",  label: "Etiopía (+251)" },
  { code: "+252",  label: "Somalia (+252)" },
  { code: "+253",  label: "Yibuti (+253)" },
  { code: "+254",  label: "Kenia (+254)" },
  { code: "+255",  label: "Tanzania (+255)" },
  { code: "+256",  label: "Uganda (+256)" },
  { code: "+257",  label: "Burundi (+257)" },
  { code: "+258",  label: "Mozambique (+258)" },
  { code: "+260",  label: "Zambia (+260)" },
  { code: "+261",  label: "Madagascar (+261)" },
  { code: "+262",  label: "Reunión / Mayotte (+262)" },
  { code: "+263",  label: "Zimbabue (+263)" },
  { code: "+264",  label: "Namibia (+264)" },
  { code: "+265",  label: "Malaui (+265)" },
  { code: "+266",  label: "Lesoto (+266)" },
  { code: "+267",  label: "Botsuana (+267)" },
  { code: "+268",  label: "Esuatini (+268)" },
  { code: "+269",  label: "Comoras (+269)" },
  { code: "+27",   label: "Sudáfrica (+27)" },
  { code: "+290",  label: "Santa Elena (+290)" },
  { code: "+291",  label: "Eritrea (+291)" },
  { code: "+297",  label: "Aruba (+297)" },
  { code: "+298",  label: "Islas Feroe (+298)" },
  { code: "+299",  label: "Groenlandia (+299)" },
  { code: "+30",   label: "Grecia (+30)" },
  { code: "+31",   label: "Países Bajos (+31)" },
  { code: "+32",   label: "Bélgica (+32)" },
  { code: "+33",   label: "Francia (+33)" },
  { code: "+34",   label: "España (+34)" },
  { code: "+350",  label: "Gibraltar (+350)" },
  { code: "+351",  label: "Portugal (+351)" },
  { code: "+352",  label: "Luxemburgo (+352)" },
  { code: "+353",  label: "Irlanda (+353)" },
  { code: "+354",  label: "Islandia (+354)" },
  { code: "+355",  label: "Albania (+355)" },
  { code: "+356",  label: "Malta (+356)" },
  { code: "+357",  label: "Chipre (+357)" },
  { code: "+358",  label: "Finlandia (+358)" },
  { code: "+359",  label: "Bulgaria (+359)" },
  { code: "+36",   label: "Hungría (+36)" },
  { code: "+370",  label: "Lituania (+370)" },
  { code: "+371",  label: "Letonia (+371)" },
  { code: "+372",  label: "Estonia (+372)" },
  { code: "+373",  label: "Moldavia (+373)" },
  { code: "+374",  label: "Armenia (+374)" },
  { code: "+375",  label: "Bielorrusia (+375)" },
  { code: "+376",  label: "Andorra (+376)" },
  { code: "+377",  label: "Mónaco (+377)" },
  { code: "+378",  label: "San Marino (+378)" },
  { code: "+379",  label: "Vaticano (+379)" },
  { code: "+380",  label: "Ucrania (+380)" },
  { code: "+381",  label: "Serbia (+381)" },
  { code: "+382",  label: "Montenegro (+382)" },
  { code: "+383",  label: "Kosovo (+383)" },
  { code: "+385",  label: "Croacia (+385)" },
  { code: "+386",  label: "Eslovenia (+386)" },
  { code: "+387",  label: "Bosnia y Herzegovina (+387)" },
  { code: "+389",  label: "Macedonia del Norte (+389)" },
  { code: "+39",   label: "Italia (+39)" },
  { code: "+40",   label: "Rumania (+40)" },
  { code: "+41",   label: "Suiza (+41)" },
  { code: "+420",  label: "República Checa (+420)" },
  { code: "+421",  label: "Eslovaquia (+421)" },
  { code: "+423",  label: "Liechtenstein (+423)" },
  { code: "+43",   label: "Austria (+43)" },
  { code: "+44",   label: "Reino Unido (+44)" },
  { code: "+45",   label: "Dinamarca (+45)" },
  { code: "+46",   label: "Suecia (+46)" },
  { code: "+47",   label: "Noruega (+47)" },
  { code: "+48",   label: "Polonia (+48)" },
  { code: "+49",   label: "Alemania (+49)" },
  { code: "+500",  label: "Islas Malvinas (+500)" },
  { code: "+501",  label: "Belice (+501)" },
  { code: "+502",  label: "Guatemala (+502)" },
  { code: "+503",  label: "El Salvador (+503)" },
  { code: "+504",  label: "Honduras (+504)" },
  { code: "+505",  label: "Nicaragua (+505)" },
  { code: "+506",  label: "Costa Rica (+506)" },
  { code: "+507",  label: "Panamá (+507)" },
  { code: "+508",  label: "San Pedro y Miquelón (+508)" },
  { code: "+509",  label: "Haití (+509)" },
  { code: "+51",   label: "Perú (+51)" },
  { code: "+52",   label: "México (+52)" },
  { code: "+53",   label: "Cuba (+53)" },
  { code: "+54",   label: "Argentina (+54)" },
  { code: "+55",   label: "Brasil (+55)" },
  { code: "+56",   label: "Chile (+56)" },
  { code: "+57",   label: "Colombia (+57)" },
  { code: "+58",   label: "Venezuela (+58)" },
  { code: "+590",  label: "Guadalupe (+590)" },
  { code: "+591",  label: "Bolivia (+591)" },
  { code: "+592",  label: "Guyana (+592)" },
  { code: "+593",  label: "Ecuador (+593)" },
  { code: "+594",  label: "Guayana Francesa (+594)" },
  { code: "+595",  label: "Paraguay (+595)" },
  { code: "+596",  label: "Martinica (+596)" },
  { code: "+597",  label: "Surinam (+597)" },
  { code: "+598",  label: "Uruguay (+598)" },
  { code: "+599",  label: "Antillas Neerlandesas (+599)" },
  { code: "+60",   label: "Malasia (+60)" },
  { code: "+61",   label: "Australia (+61)" },
  { code: "+62",   label: "Indonesia (+62)" },
  { code: "+63",   label: "Filipinas (+63)" },
  { code: "+64",   label: "Nueva Zelanda (+64)" },
  { code: "+65",   label: "Singapur (+65)" },
  { code: "+66",   label: "Tailandia (+66)" },
  { code: "+81",   label: "Japón (+81)" },
  { code: "+82",   label: "Corea del Sur (+82)" },
  { code: "+84",   label: "Vietnam (+84)" },
  { code: "+86",   label: "China (+86)" },
  { code: "+855",  label: "Camboya (+855)" },
  { code: "+856",  label: "Laos (+856)" },
  { code: "+880",  label: "Bangladés (+880)" },
  { code: "+886",  label: "Taiwán (+886)" },
  { code: "+90",   label: "Turquía (+90)" },
  { code: "+91",   label: "India (+91)" },
  { code: "+92",   label: "Pakistán (+92)" },
  { code: "+93",   label: "Afganistán (+93)" },
  { code: "+94",   label: "Sri Lanka (+94)" },
  { code: "+95",   label: "Myanmar (+95)" },
  { code: "+960",  label: "Maldivas (+960)" },
  { code: "+961",  label: "Líbano (+961)" },
  { code: "+962",  label: "Jordania (+962)" },
  { code: "+963",  label: "Siria (+963)" },
  { code: "+964",  label: "Irak (+964)" },
  { code: "+965",  label: "Kuwait (+965)" },
  { code: "+966",  label: "Arabia Saudita (+966)" },
  { code: "+967",  label: "Yemen (+967)" },
  { code: "+968",  label: "Omán (+968)" },
  { code: "+970",  label: "Palestina (+970)" },
  { code: "+971",  label: "Emiratos Árabes Unidos (+971)" },
  { code: "+972",  label: "Israel (+972)" },
  { code: "+973",  label: "Baréin (+973)" },
  { code: "+974",  label: "Catar (+974)" },
  { code: "+975",  label: "Bután (+975)" },
  { code: "+976",  label: "Mongolia (+976)" },
  { code: "+977",  label: "Nepal (+977)" },
  { code: "+98",   label: "Irán (+98)" },
  { code: "+992",  label: "Tayikistán (+992)" },
  { code: "+993",  label: "Turkmenistán (+993)" },
  { code: "+994",  label: "Azerbaiyán (+994)" },
  { code: "+995",  label: "Georgia (+995)" },
  { code: "+996",  label: "Kirguistán (+996)" },
  { code: "+998",  label: "Uzbekistán (+998)" },
];

let reportCounter = 104;

function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
        {number}. {title}
      </h3>
      {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {label}{required && <span className="text-crisis ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full text-sm bg-white border border-border rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-colors";

const textareaCls =
  "w-full text-sm bg-white border border-border rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-colors resize-none";

export function TabDesaparecidos() {
  const [submitted, setSubmitted]         = useState(false);
  const [lastCode, setLastCode]           = useState("");
  const [codigoPais, setCodigoPais]       = useState("+1");
  const [telInternacional, setTelIntl]    = useState("");
  const [estado, setEstado]               = useState("Abierto");
  const [mostrarUbicacion, setMostrarUb]  = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = `R-${reportCounter++}`;
    setLastCode(code);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 6000);
    (e.target as HTMLFormElement).reset();
    setCodigoPais("+1");
    setTelIntl("");
    setEstado("Abierto");
    setMostrarUb(false);
  };

  const handleLlamar = () => {
    if (!telInternacional) return;
    const full = `${codigoPais}${telInternacional.replace(/\D/g, "")}`;
    window.open(`tel:${full}`, "_self");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-6">
      <div className="border-b border-border pb-3 mb-6">
        <h2 className="text-lg font-bold text-gray-800">Reporte de Persona Desaparecida</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Datos para equipos de búsqueda y rescate (SAR) · El código se asigna automáticamente.
        </p>
      </div>

      {submitted && (
        <div className="mb-5 bg-primary-light border border-primary/30 text-primary rounded-lg px-4 py-3 text-sm font-semibold">
          Alerta emitida — Código asignado: <span className="font-bold">{lastCode}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* 1. Informante */}
        <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
          <SectionHeader
            number="1"
            title="Datos de quien Reporta (Informante)"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Su Nombre Completo" required>
              <input type="text" required placeholder="Nombre y apellido" className={inputCls} />
            </Field>
            <Field label="Parentesco con el Desaparecido" required>
              <input
                type="text"
                required
                placeholder="Ej: Madre, Hermano, Vecino…"
                className={inputCls}
              />
            </Field>
            <Field label="Teléfono de Contacto (Venezuela)" required>
              <input type="tel" required placeholder="04XX-XXXXXXX" className={inputCls} />
            </Field>
          </div>
          <Field label="Correo Electrónico / Contacto Alternativo">
            <input type="email" placeholder="correo@ejemplo.com" className={inputCls} />
          </Field>
        </section>

        {/* 2. Desaparecido */}
        <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
          <SectionHeader number="2" title="Datos del Familiar Desaparecido" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Field label="Nombre Completo del Familiar" required>
                <input type="text" required className={inputCls} />
              </Field>
            </div>
            <Field label="Cédula / ID (si aplica)">
              <input type="text" placeholder="V-00000000" className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Edad aprox.">
                <input type="number" min="0" max="120" className={inputCls} />
              </Field>
              <Field label="Género">
                <select className={inputCls}>
                  <option>Masculino</option>
                  <option>Femenino</option>
                  <option>Otro</option>
                </select>
              </Field>
            </div>
            <Field label="Sector donde residía" required>
              <select required className={inputCls}>
                <option value="">Seleccionar…</option>
                {SECTORES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Edificio / Casa de vivienda">
              <input type="text" placeholder="Residencias El Mar, Torre B…" className={inputCls} />
            </Field>
          </div>
        </section>

        {/* 3. Física / Último avistamiento */}
        <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
          <SectionHeader
            number="3"
            title="Información Física y Último Avistamiento"
          />
          <Field label="Último lugar, fecha y hora donde fue visto" required>
            <input
              type="text"
              required
              placeholder="Ej: En su apartamento en Res. El Mar a las 6:00 AM del 25-Jun…"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Descripción Física (estatura, cabello, cicatrices, tatuajes)">
              <textarea
                rows={3}
                placeholder="Cualquier rasgo distintivo para los rescatistas…"
                className={textareaCls}
              />
            </Field>
            <Field label="Vestimenta al momento de la desaparición">
              <textarea
                rows={3}
                placeholder="Color de camisa, pantalón, calzado si lo recuerda…"
                className={textareaCls}
              />
            </Field>
          </div>
          <Field label="¿Tiene condición médica o discapacidad?">
            <input
              type="text"
              placeholder="Ej: Asmático severo, requiere insulina, hipertenso…"
              className={inputCls}
            />
          </Field>
        </section>

        {/* 4. Contacto Internacional ← clave */}
        <section className="rounded-lg border-2 border-primary/30 bg-primary-light p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div>
              <h3 className="text-sm font-bold text-primary">
                Contacto con Familiares en el Exterior
              </h3>
              <p className="text-[11px] text-primary/70">
                Línea habilitada para comunicación directa con familias desde el extranjero.
              </p>
            </div>
          </div>

          {/* Línea de crisis */}
          <div className="bg-white border border-primary/20 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Línea de crisis Apoyo SaluPro
              </p>
              <p className="text-xl font-bold text-primary tracking-wider">
                +58 212-000-0000
              </p>
            </div>
            <a
              href="tel:+582120000000"
              className="shrink-0 bg-primary hover:bg-primary-dark text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
            >
              Llamar ahora
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="País de residencia del familiar">
              <select
                value={codigoPais}
                onChange={(e) => setCodigoPais(e.target.value)}
                className={inputCls}
              >
                {PAISES.map((p) => (
                  <option key={p.code} value={p.code}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Teléfono internacional del familiar">
              <div className="flex gap-2">
                <span className="shrink-0 flex items-center px-3 bg-white border border-border rounded-lg text-sm font-mono font-semibold text-gray-700">
                  {codigoPais}
                </span>
                <input
                  type="tel"
                  value={telInternacional}
                  onChange={(e) => setTelIntl(e.target.value)}
                  placeholder="555 123 4567"
                  className={inputCls}
                />
              </div>
            </Field>
          </div>

          {telInternacional && (
            <button
              type="button"
              onClick={handleLlamar}
              className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg
                transition-colors text-sm tracking-wide"
            >
              LLAMAR AL FAMILIAR AHORA — {codigoPais} {telInternacional}
            </button>
          )}

          <Field label="Notas de la llamada / Mensaje para el familiar">
            <textarea
              rows={2}
              placeholder="Resumen del contacto con el familiar en el exterior…"
              className={textareaCls}
            />
          </Field>
        </section>

        {/* 5. Estado del reporte */}
        <section className="bg-muted rounded-lg border border-border p-4 space-y-4">
          <SectionHeader number="5" title="Estado del Reporte" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Estado actual">
              <select
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value);
                  setMostrarUb(e.target.value === "Localizado" || e.target.value === "Trasladado");
                }}
                className={inputCls}
              >
                <option>Abierto</option>
                <option>Localizado</option>
                <option>Trasladado</option>
              </select>
            </Field>
            {mostrarUbicacion && (
              <Field label="Ubicación donde fue encontrado">
                <input
                  type="text"
                  placeholder="Ej: Refugio Escuela República de Panamá…"
                  className={inputCls}
                />
              </Field>
            )}
          </div>
        </section>

        <button
          type="submit"
          className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3.5 rounded-lg
            shadow-sm transition-colors text-sm tracking-wide"
        >
          EMITIR ALERTA DE BÚSQUEDA
        </button>
      </form>
    </div>
  );
}
