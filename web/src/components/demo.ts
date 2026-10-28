import type { Message, ToolCall } from '../api';

/**
 * Respuestas de una ejecución real del sistema (gemini-flash-lite-latest), para
 * enseñar el asistente aunque el LLM no esté disponible. La última está recortada.
 */
const meta = (toolCalls: ToolCall[], latencyMs: number) => ({
  status: 'ok' as const,
  model: 'models/gemini-flash-lite-latest',
  toolCalls,
  consistencySuspects: [] as number[],
  latencyMs,
  runId: 0,
});

export const DEMO_CONVERSATION: Message[] = [
  { id: 'demo-1', role: 'user', content: '¿Quién ganó el GP de Monza en 2019?', metadata: null, createdAt: '' },
  {
    id: 'demo-2',
    role: 'assistant',
    content:
      "El ganador del Gran Premio de Monza en 2019 fue **Charles Leclerc** a bordo de su Ferrari, logrando una histórica victoria para la 'Scuderia' en casa.\n\nAquí tienes el podio de esa carrera:\n\n| Posición | Piloto | Constructor |\n| :--- | :--- | :--- |\n| **1º** | Charles Leclerc | Ferrari |\n| **2º** | Valtteri Bottas | Mercedes |\n| **3º** | Lewis Hamilton | Mercedes |",
    metadata: meta([{ name: 'get_race_results', args: { year: 2019, circuit: 'Autodromo Nazionale Monza' }, error: null }], 4257),
    createdAt: '',
  },
  { id: 'demo-3', role: 'user', content: '¿Y quién quedó segundo?', metadata: null, createdAt: '' },
  {
    id: 'demo-4',
    role: 'assistant',
    content: 'En el Gran Premio de Monza de 2019, el piloto que quedó en **segunda posición** fue **Valtteri Bottas** con el equipo Mercedes.',
    metadata: meta([], 2259),
    createdAt: '',
  },
  {
    id: 'demo-5',
    role: 'user',
    content: '¿En qué posición acabaría Leclerc en Monza 2024 saliendo desde la pole con Ferrari?',
    metadata: null,
    createdAt: '',
  },
  {
    id: 'demo-6',
    role: 'assistant',
    content:
      'El modelo predice que Charles Leclerc terminará en la **4ª posición** en el Gran Premio de Monza de 2024 saliendo desde la pole con Ferrari.\n\nPara realizar esta estimación, el modelo XGBoost ha utilizado de forma interna 10 características pre-carrera, entre las que destacan:\n\n* **Posición de salida (Grid):** 1 (Pole Position)\n* **Constructor:** Ferrari\n* **Posición actual en el campeonato:** 3º\n* **Experiencia del piloto:** 140 Grandes Premios disputados',
    metadata: meta(
      [
        {
          name: 'predict_position',
          args: { year: 2024, circuit: 'Autodromo Nazionale Monza', driver_number: 16, grid: 1, constructor: 'Ferrari' },
          error: null,
        },
      ],
      4094,
    ),
    createdAt: '',
  },
];
