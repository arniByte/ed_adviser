const VERDICT = ['пока мимо', 'направление верное', 'хороший ответ', 'сильный ответ']

/** Оценка из трёх точек: набранные — резкие, остальные — в расфокусе. */
export function ScoreDots({ score, withVerdict = true }: { score: number; withVerdict?: boolean }) {
  return (
    <span className="score" role="img" aria-label={`Оценка ${score} из 3: ${VERDICT[score]}`}>
      <span className="score__dots" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className="score__dot" data-on={n <= score} />
        ))}
      </span>
      {withVerdict && <span className="label score__verdict">{VERDICT[score]}</span>}
    </span>
  )
}
