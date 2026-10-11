import type { SourceStatus } from '../../shared/types';
import { formatAge } from '../logic/format';

export function SourceStatusFooter({ sources, generatedAt }: {
  sources: Record<string, SourceStatus>;
  generatedAt: string;
}) {
  const now = new Date();
  return (
    <footer class="footer">
      <p>Päivitetty {formatAge(generatedAt, now)}.</p>
      <ul>
        {Object.entries(sources).map(([id, s]) => (
          <li key={id} class={s.lastError ? 'source-error' : ''}>
            {s.name}: {s.lastSuccess ? `päivitetty ${formatAge(s.lastSuccess, now)}` : 'ei vielä onnistunut'}
            {s.lastError ? ' ⚠︎' : ''}
          </li>
        ))}
      </ul>
    </footer>
  );
}
