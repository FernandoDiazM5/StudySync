// ============================================
// SUBTASK SUGGESTIONS - StudySync
// Motor de sugerencias basado en palabras clave
// ============================================

// Cada regla: pattern (regex sobre el título) + items (5 subtareas sugeridas)
const PATTERNS = [
  {
    test: /programar|código|implementar|desarrollar|función|app|aplicaci[oó]n|software|algoritmo|clase|m[oó]dulo|api|web|backend|frontend|base de datos|script|debug|bug/i,
    items: [
      'Definir requisitos y casos de uso',
      'Diseñar la estructura del código',
      'Implementar la lógica principal',
      'Escribir pruebas y corregir errores',
      'Documentar el código',
    ],
  },
  {
    test: /ensayo|redact|escrib|informe|reporte|artículo|abstract|tesis|monograf|paper/i,
    items: [
      'Definir la tesis y estructura del texto',
      'Buscar y revisar fuentes bibliográficas',
      'Redactar el borrador completo',
      'Revisar coherencia y argumentos',
      'Corregir estilo, ortografía y formato',
    ],
  },
  {
    test: /investigar|investigaci[oó]n|buscar|recopilar|fuentes|bibliograf|estudio de caso|marco te[oó]rico/i,
    items: [
      'Plantear preguntas de investigación',
      'Buscar y seleccionar fuentes confiables',
      'Leer y tomar notas estructuradas',
      'Sintetizar y organizar la información',
      'Elaborar la lista de referencias',
    ],
  },
  {
    test: /presentaci[oó]n|exponer|exposici[oó]n|diapositiva|slides|ppt|p[oó]ster|defensa/i,
    items: [
      'Definir estructura y mensaje clave',
      'Crear las diapositivas base',
      'Agregar gráficos y ejemplos visuales',
      'Preparar notas del orador',
      'Practicar y cronometrar la presentación',
    ],
  },
  {
    test: /ejercicio|problema|calcul|matem[aá]tic|ecuaci[oó]n|integral|derivad|[aá]lgebra|estad[ií]stic|resolv/i,
    items: [
      'Leer el enunciado y anotar los datos',
      'Identificar el método de solución',
      'Resolver el problema paso a paso',
      'Verificar el resultado con otra vía',
      'Revisar ejercicios similares del temario',
    ],
  },
  {
    test: /laboratorio|experimento|pr[aá]ctica|lab |muestra|protocolo|informe de lab/i,
    items: [
      'Revisar el protocolo experimental',
      'Preparar materiales y equipos',
      'Ejecutar el experimento y registrar datos',
      'Procesar y graficar los resultados',
      'Redactar el informe de laboratorio',
    ],
  },
  {
    test: /leer|lectura|analizar|an[aá]lisis|cap[ií]tulo|libro|texto cl[aá]sico/i,
    items: [
      'Hacer una lectura exploratoria del texto',
      'Leer con atención y subrayar ideas clave',
      'Elaborar resumen o mapa conceptual',
      'Identificar tesis y argumentos del autor',
      'Preparar preguntas o comentarios críticos',
    ],
  },
  {
    test: /estudiar|repasar|examen|parcial|final|prueba|quiz|repaso|preparar para/i,
    items: [
      'Revisar notas y apuntes del tema',
      'Crear un mapa mental del contenido',
      'Resolver ejercicios o preguntas de práctica',
      'Identificar y reforzar puntos débiles',
      'Simular el examen o prueba cronometrado',
    ],
  },
  {
    test: /proyecto|trabajo final|diseñ|planificar|plan de|propuesta/i,
    items: [
      'Definir objetivo y alcance del proyecto',
      'Dividir en tareas y asignar responsables',
      'Recopilar los recursos necesarios',
      'Desarrollar la parte principal',
      'Revisar, corregir y preparar la entrega',
    ],
  },
  {
    test: /dise[ñn]o|prototipo|wireframe|mockup|interfaz|ux|ui/i,
    items: [
      'Definir los requisitos de diseño',
      'Crear bocetos o wireframes iniciales',
      'Diseñar el prototipo de alta fidelidad',
      'Validar con usuarios o compañeros',
      'Ajustar según los comentarios recibidos',
    ],
  },
];

const DEFAULT_ITEMS = [
  'Leer y comprender el objetivo',
  'Buscar recursos o material de apoyo',
  'Elaborar un borrador o plan de trabajo',
  'Desarrollar y completar la tarea',
  'Revisar y preparar la entrega final',
];

/**
 * Devuelve 5 subtareas sugeridas basadas en el título de la tarea.
 * @param {string} taskTitle
 * @returns {string[]}
 */
export function suggestSubtasks(taskTitle) {
  const title = taskTitle || '';
  for (const rule of PATTERNS) {
    if (rule.test.test(title)) return rule.items;
  }
  return DEFAULT_ITEMS;
}
